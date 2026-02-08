/**
 * Serviço para gerenciamento de documentos PDF vinculados aos processos
 *
 * Funcionalidades:
 * - Upload de PDFs para Supabase Storage
 * - Registro de metadados no banco de dados
 * - Busca de documentos por processo
 * - Exclusão de documentos (arquivo + registro)
 * - Armazenamento temporário em sessionStorage
 */

import { supabase } from '../lib/supabase';
import {
  ProcessDocument,
  NewProcessDocument,
  TemporaryDocument,
  DocumentUploadResult,
  DOCUMENT_CONSTANTS,
  DocumentValidation
} from '../types/ProcessDocument';
import { ProcessDocumentRecord } from '../types/database';
import logger from '../utils/logger';

const triggerTextExtraction = (documentId: string): void => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn(
      'Supabase environment variables not available for text extraction',
      undefined,
      'processDocumentService.triggerTextExtraction'
    );
    return;
  }

  const extractUrl = `${supabaseUrl}/functions/v1/extract-pdf-text`;

  fetch(extractUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ process_document_id: documentId })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        logger.success(
          `Text extraction completed: ${result.pages_extracted} pages`,
          'processDocumentService.triggerTextExtraction',
          { documentId, pagesExtracted: result.pages_extracted }
        );
      } else if (result.message) {
        logger.info(
          result.message,
          'processDocumentService.triggerTextExtraction',
          { documentId }
        );
      } else {
        logger.warn(
          'Text extraction returned unexpected result',
          result,
          'processDocumentService.triggerTextExtraction',
          { documentId }
        );
      }
    })
    .catch(error => {
      logger.warn(
        'Text extraction failed (non-blocking)',
        error,
        'processDocumentService.triggerTextExtraction',
        { documentId }
      );
    });
};

/**
 * Converte record do banco para tipo de domínio
 */
const mapRecordToDocument = (record: ProcessDocumentRecord): ProcessDocument => {
  return {
    id: record.id,
    processId: record.process_id,
    fileName: record.file_name,
    filePath: record.file_path,
    fileSize: record.file_size,
    mimeType: record.mime_type,
    sequenceOrder: record.sequence_order,
    displayName: record.display_name,
    dataCriacao: new Date(record.created_at),
    dataAtualizacao: new Date(record.updated_at)
  };
};

/**
 * Valida se uma URL é válida e acessível
 */
const validatePublicUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Verifica se começa com http ou https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // Verifica se contém o bucket name esperado
  if (!url.includes('process-documents')) {
    logger.warn(
      'URL pública não contém o nome do bucket esperado',
      undefined,
      'processDocumentService.validatePublicUrl',
      { url }
    );
  }

  return true;
};

/**
 * Busca todos os documentos vinculados a um processo
 * Retorna array ordenado por sequence_order
 */
export const getDocumentsByProcessId = async (processId: string): Promise<ProcessDocument[]> => {
  try {
    logger.info(
      `Buscando documentos do processo: ${processId}`,
      'processDocumentService.getDocumentsByProcessId'
    );

    const { data, error } = await supabase
      .from('process_documents')
      .select('*')
      .eq('process_id', processId)
      .order('sequence_order', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      logger.info(
        `Nenhum documento encontrado para o processo: ${processId}`,
        'processDocumentService.getDocumentsByProcessId'
      );
      return [];
    }

    const documents = data.map(record => {
      const document = mapRecordToDocument(record);

      // Gera URL pública para o arquivo
      const { data: urlData } = supabase.storage
        .from(DOCUMENT_CONSTANTS.STORAGE_BUCKET)
        .getPublicUrl(document.filePath);

      document.url = urlData.publicUrl;

      // Valida se a URL foi gerada corretamente
      if (!validatePublicUrl(document.url)) {
        logger.warn(
          'URL pública inválida gerada para documento',
          undefined,
          'processDocumentService.getDocumentsByProcessId',
          { documentId: document.id, url: document.url }
        );
      }

      return document;
    });

    logger.success(
      `${documents.length} documento(s) encontrado(s): ${documents.map(d => d.displayName).join(', ')}`,
      'processDocumentService.getDocumentsByProcessId',
      { processId, count: documents.length }
    );

    return documents;
  } catch (error) {
    logger.errorWithException(
      'Erro ao buscar documentos do processo',
      error as Error,
      'processDocumentService.getDocumentsByProcessId',
      { processId }
    );
    throw error;
  }
};

/**
 * Busca documento vinculado a um processo (retrocompatibilidade)
 * Retorna o primeiro documento da sequência
 */
export const getDocumentByProcessId = async (processId: string): Promise<ProcessDocument | null> => {
  const documents = await getDocumentsByProcessId(processId);
  return documents.length > 0 ? documents[0] : null;
};

/**
 * Obtem o próximo sequence_order para um processo
 */
export const getNextSequenceOrder = async (processId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .rpc('get_next_sequence_order', { p_process_id: processId });

    if (error) throw error;

    return data || 1;
  } catch (error) {
    logger.errorWithException(
      'Erro ao obter próximo sequence_order',
      error as Error,
      'processDocumentService.getNextSequenceOrder',
      { processId }
    );
    // Em caso de erro, busca manualmente
    const documents = await getDocumentsByProcessId(processId);
    return documents.length > 0 ? Math.max(...documents.map(d => d.sequenceOrder)) + 1 : 1;
  }
};

/**
 * Faz upload de documento PDF para o Supabase Storage
 * Adiciona novo PDF na sequência (não substitui existente)
 */
export const uploadDocument = async (
  processId: string,
  file: File,
  sequenceOrder?: number,
  displayName?: string
): Promise<DocumentUploadResult> => {
  try {
    logger.info(
      `Iniciando upload de documento para processo: ${processId}`,
      'processDocumentService.uploadDocument',
      { fileName: file.name, fileSize: file.size }
    );

    // Validação do arquivo
    const validation = DocumentValidation.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Determina o sequence_order
    const finalSequenceOrder = sequenceOrder || await getNextSequenceOrder(processId);

    logger.info(
      `Adicionando documento na sequência ${finalSequenceOrder}`,
      'processDocumentService.uploadDocument',
      { processId, sequenceOrder: finalSequenceOrder }
    );

    // Gera caminho único para o arquivo
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${processId}/${timestamp}_${sanitizedFileName}`;

    // Faz upload do arquivo para o storage
    logger.info(
      `Fazendo upload do arquivo: ${filePath}`,
      'processDocumentService.uploadDocument'
    );

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(DOCUMENT_CONSTANTS.STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logger.error(
        'Erro detalhado no upload para storage',
        uploadError,
        'processDocumentService.uploadDocument',
        {
          errorCode: uploadError.name,
          errorMessage: uploadError.message,
          filePath,
          bucket: DOCUMENT_CONSTANTS.STORAGE_BUCKET
        }
      );
      throw uploadError;
    }

    logger.success(
      `Arquivo enviado com sucesso para o storage: ${uploadData.path}`,
      'processDocumentService.uploadDocument'
    );

    // Prepara dados para o banco
    logger.info(
      `Criando novo registro do documento no banco`,
      'processDocumentService.uploadDocument'
    );

    const insertData: Record<string, unknown> = {
      process_id: processId,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      mime_type: file.type,
      sequence_order: finalSequenceOrder
    };

    if (displayName) {
      insertData.display_name = displayName;
    }

    const { data: savedDocument, error: dbError } = await supabase
      .from('process_documents')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      logger.error(
        'Erro ao inserir registro no banco',
        dbError,
        'processDocumentService.uploadDocument',
        {
          errorCode: dbError.code,
          errorMessage: dbError.message,
          processId
        }
      );
      throw dbError;
    }

    const document = mapRecordToDocument(savedDocument);

    // Gera URL pública
    const { data: urlData } = supabase.storage
      .from(DOCUMENT_CONSTANTS.STORAGE_BUCKET)
      .getPublicUrl(document.filePath);

    document.url = urlData.publicUrl;

    // Valida se a URL foi gerada corretamente
    if (!validatePublicUrl(document.url)) {
      logger.error(
        'URL pública inválida gerada após upload',
        undefined,
        'processDocumentService.uploadDocument',
        { documentId: document.id, url: document.url }
      );
      throw new Error('URL pública inválida. Verifique a configuração do Supabase Storage.');
    }

    logger.success(
      `Documento salvo com sucesso: ${document.fileName}`,
      'processDocumentService.uploadDocument',
      { documentId: document.id, processId, url: document.url }
    );

    triggerTextExtraction(document.id);

    return {
      success: true,
      document
    };
  } catch (error) {
    logger.errorWithException(
      'Erro ao fazer upload do documento',
      error as Error,
      'processDocumentService.uploadDocument',
      { processId, fileName: file.name }
    );

    // Extrai mensagem de erro mais específica
    let errorMessage = 'Erro ao fazer upload do documento. Tente novamente.';

    if (error && typeof error === 'object') {
      const err = error as any;

      // Erros de storage
      if (err.statusCode === '403' || err.message?.includes('permission') || err.message?.includes('policy')) {
        errorMessage = 'Sem permissão para fazer upload. Verifique as configurações do Supabase.';
      } else if (err.statusCode === '404' || err.message?.includes('bucket')) {
        errorMessage = 'Bucket de armazenamento não encontrado. Execute as migrações do banco.';
      } else if (err.message?.includes('size') || err.message?.includes('large')) {
        errorMessage = 'Arquivo muito grande. Tamanho máximo: 200MB.';
      } else if (err.message?.includes('type') || err.message?.includes('mime')) {
        errorMessage = 'Tipo de arquivo inválido. Apenas PDFs são permitidos.';
      } else if (err.code === 'PGRST116' || err.message?.includes('violates')) {
        errorMessage = 'Erro de validação no banco de dados. Verifique os dados do processo.';
      } else if (err.message) {
        errorMessage = `Erro: ${err.message}`;
      }
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Remove documento específico por ID (arquivo + registro)
 * Lançamentos vinculados são removidos automaticamente em cascata
 */
export const deleteDocumentById = async (documentId: string): Promise<boolean> => {
  try {
    logger.info(
      `Iniciando remoção de documento: ${documentId}`,
      'processDocumentService.deleteDocumentById'
    );

    // Busca o documento para obter o caminho do arquivo
    const { data: document, error: fetchError } = await supabase
      .from('process_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!document) {
      logger.warn(
        `Nenhum documento encontrado para remoção: ${documentId}`,
        undefined,
        'processDocumentService.deleteDocumentById'
      );
      return true; // Considera sucesso se não há documento
    }

    // Remove o arquivo do storage
    logger.info(
      `Removendo arquivo do storage: ${document.file_path}`,
      'processDocumentService.deleteDocumentById'
    );

    const { error: storageError } = await supabase.storage
      .from(DOCUMENT_CONSTANTS.STORAGE_BUCKET)
      .remove([document.file_path]);

    if (storageError) {
      logger.warn(
        'Erro ao remover arquivo do storage',
        storageError,
        'processDocumentService.deleteDocumentById'
      );
    }

    // Remove o registro do banco (trigger automático reordena os restantes)
    logger.info(
      `Removendo registro do banco: ${documentId}`,
      'processDocumentService.deleteDocumentById'
    );

    const { error: dbError } = await supabase
      .from('process_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) throw dbError;

    logger.success(
      `Documento removido com sucesso: ${document.file_name}`,
      'processDocumentService.deleteDocumentById',
      { documentId, processId: document.process_id }
    );

    return true;
  } catch (error) {
    logger.errorWithException(
      'Erro ao remover documento',
      error as Error,
      'processDocumentService.deleteDocumentById',
      { documentId }
    );
    return false;
  }
};

/**
 * Remove documento do processo (retrocompatibilidade)
 * Remove o primeiro documento encontrado
 */
export const deleteDocument = async (processId: string): Promise<boolean> => {
  const document = await getDocumentByProcessId(processId);
  if (!document) return true;
  return deleteDocumentById(document.id);
};

/**
 * Faz download de um documento PDF
 * Usa o displayName como nome do arquivo baixado
 */
export const downloadDocument = async (document: ProcessDocument): Promise<boolean> => {
  try {
    if (!document.url) {
      logger.error(
        'URL do documento não disponível para download',
        undefined,
        'processDocumentService.downloadDocument',
        { documentId: document.id }
      );
      return false;
    }

    logger.info(
      `Iniciando download: ${document.displayName}`,
      'processDocumentService.downloadDocument',
      { documentId: document.id, url: document.url }
    );

    const response = await fetch(document.url);

    if (!response.ok) {
      throw new Error(`Falha ao baixar arquivo: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = window.document.createElement('a');
    link.href = downloadUrl;
    link.download = `${document.displayName}.pdf`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);

    window.URL.revokeObjectURL(downloadUrl);

    logger.success(
      `Download concluído: ${document.displayName}`,
      'processDocumentService.downloadDocument',
      { documentId: document.id }
    );

    return true;
  } catch (error) {
    logger.errorWithException(
      'Erro ao fazer download do documento',
      error as Error,
      'processDocumentService.downloadDocument',
      { documentId: document.id, displayName: document.displayName }
    );
    return false;
  }
};

/**
 * Salva documento temporariamente no sessionStorage
 */
export const saveTemporaryDocument = (processId: string, file: File): void => {
  try {
    const reader = new FileReader();

    reader.onload = () => {
      const tempDoc: TemporaryDocument = {
        processId,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        } as any,
        dataUrl: reader.result as string
      };

      const existing = getTemporaryDocuments();
      const filtered = existing.filter(d => d.processId !== processId);
      filtered.push(tempDoc);

      sessionStorage.setItem(
        DOCUMENT_CONSTANTS.SESSION_STORAGE_KEY,
        JSON.stringify(filtered)
      );

      logger.info(
        `Documento salvo temporariamente: ${file.name}`,
        'processDocumentService.saveTemporaryDocument',
        { processId }
      );
    };

    reader.readAsDataURL(file);
  } catch (error) {
    logger.errorWithException(
      'Erro ao salvar documento temporário',
      error as Error,
      'processDocumentService.saveTemporaryDocument',
      { processId }
    );
  }
};

/**
 * Recupera documento temporário do sessionStorage
 */
export const getTemporaryDocument = (processId: string): TemporaryDocument | null => {
  const docs = getTemporaryDocuments();
  return docs.find(d => d.processId === processId) || null;
};

/**
 * Recupera todos os documentos temporários
 */
export const getTemporaryDocuments = (): TemporaryDocument[] => {
  try {
    const data = sessionStorage.getItem(DOCUMENT_CONSTANTS.SESSION_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

/**
 * Remove documento temporário do sessionStorage
 */
export const clearTemporaryDocument = (processId: string): void => {
  try {
    const existing = getTemporaryDocuments();
    const filtered = existing.filter(d => d.processId !== processId);

    sessionStorage.setItem(
      DOCUMENT_CONSTANTS.SESSION_STORAGE_KEY,
      JSON.stringify(filtered)
    );

    logger.info(
      `Documento temporário removido: ${processId}`,
      'processDocumentService.clearTemporaryDocument'
    );
  } catch (error) {
    logger.errorWithException(
      'Erro ao remover documento temporário',
      error as Error,
      'processDocumentService.clearTemporaryDocument',
      { processId }
    );
  }
};

/**
 * Obtém estatísticas de lançamentos vinculados a um documento
 */
export const getDocumentStatistics = async (documentId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_document_statistics', { p_document_id: documentId });

    if (error) throw error;

    return data[0] || {
      decisions_count: 0,
      verbas_count: 0,
      documentos_count: 0,
      total_count: 0
    };
  } catch (error) {
    logger.errorWithException(
      'Erro ao obter estatísticas do documento',
      error as Error,
      'processDocumentService.getDocumentStatistics',
      { documentId }
    );
    return {
      decisions_count: 0,
      verbas_count: 0,
      documentos_count: 0,
      total_count: 0
    };
  }
};

export default {
  getDocumentByProcessId,
  getDocumentsByProcessId,
  getNextSequenceOrder,
  uploadDocument,
  deleteDocument,
  deleteDocumentById,
  downloadDocument,
  getDocumentStatistics,
  saveTemporaryDocument,
  getTemporaryDocument,
  getTemporaryDocuments,
  clearTemporaryDocument
};
