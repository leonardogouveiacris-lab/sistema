/**
 * Hook personalizado para gerenciamento de documentos de processo
 *
 * Funcionalidades:
 * - Carregar documento de um processo
 * - Fazer upload de novo documento
 * - Remover documento
 * - Gerenciar estados de loading e erro
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessDocument, DocumentUploadResult } from '../types/ProcessDocument';
import ProcessDocumentService from '../services/processDocument.service';
import logger from '../utils/logger';

/**
 * Interface de retorno do hook
 */
interface UseProcessDocumentsReturn {
  document: ProcessDocument | null;           // Primeiro documento (retrocompatibilidade)
  documents: ProcessDocument[];               // Todos os documentos
  isLoading: boolean;
  error: string | null;
  uploadProgress: number;
  loadDocument: (processId: string) => Promise<void>;
  loadDocuments: (processId: string) => Promise<void>;
  uploadDocument: (processId: string, file: File, displayName?: string) => Promise<DocumentUploadResult>;
  deleteDocument: (processId: string) => Promise<boolean>;
  deleteDocumentById: (documentId: string) => Promise<boolean>;
  getDocumentStatistics: (documentId: string) => Promise<any>;
  clearError: () => void;
}

/**
 * Hook useProcessDocuments
 */
export const useProcessDocuments = (initialProcessId?: string): UseProcessDocumentsReturn => {
  const [document, setDocument] = useState<ProcessDocument | null>(null);
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (progressResetTimeoutRef.current) {
        clearTimeout(progressResetTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Carrega todos os documentos de um processo
   */
  const loadDocuments = useCallback(async (processId: string) => {
    if (!processId) {
      logger.warn('ProcessId não fornecido para loadDocuments', 'useProcessDocuments');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const docs = await ProcessDocumentService.getDocumentsByProcessId(processId);
      setDocuments(docs);
      setDocument(docs.length > 0 ? docs[0] : null);
    } catch (err) {
      const errorMessage = 'Erro ao carregar documentos';
      setError(errorMessage);

      logger.errorWithException(
        errorMessage,
        err as Error,
        'useProcessDocuments.loadDocuments',
        { processId }
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Carrega documento de um processo (retrocompatibilidade)
   * Carrega primeiro documento e também o array completo
   */
  const loadDocument = useCallback(async (processId: string) => {
    await loadDocuments(processId);
  }, [loadDocuments]);

  /**
   * Faz upload de documento
   */
  const uploadDocument = useCallback(async (
    processId: string,
    file: File,
    displayName?: string
  ): Promise<DocumentUploadResult> => {
    if (!processId || !file) {
      return { success: false, error: 'ProcessId e arquivo são obrigatórios' };
    }

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await ProcessDocumentService.uploadDocument(processId, file, undefined, displayName);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.document) {
        await loadDocuments(processId);

        if (progressResetTimeoutRef.current) {
          clearTimeout(progressResetTimeoutRef.current);
        }
        progressResetTimeoutRef.current = setTimeout(() => setUploadProgress(0), 1000);
      } else {
        setError(result.error || 'Erro ao fazer upload');
        setUploadProgress(0);
      }

      return result;
    } catch (err) {
      const errorMessage = 'Erro ao fazer upload do documento';
      setError(errorMessage);
      setUploadProgress(0);

      logger.errorWithException(
        errorMessage,
        err as Error,
        'useProcessDocuments.uploadDocument',
        { processId, fileName: file.name }
      );

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [loadDocuments]);

  /**
   * Remove documento
   */
  const deleteDocument = useCallback(async (processId: string): Promise<boolean> => {
    if (!processId) {
      logger.warn('ProcessId não fornecido para deleteDocument', 'useProcessDocuments');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await ProcessDocumentService.deleteDocument(processId);

      if (success) {
        setDocument(null);
      } else {
        setError('Erro ao remover documento');
      }

      return success;
    } catch (err) {
      const errorMessage = 'Erro ao remover documento';
      setError(errorMessage);

      logger.errorWithException(
        errorMessage,
        err as Error,
        'useProcessDocuments.deleteDocument',
        { processId }
      );

      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Remove documento específico por ID
   */
  const deleteDocumentById = useCallback(async (documentId: string): Promise<boolean> => {
    if (!documentId) {
      logger.warn('DocumentId não fornecido para deleteDocumentById', 'useProcessDocuments');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await ProcessDocumentService.deleteDocumentById(documentId);

      if (success) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        setDocument(prev => prev?.id === documentId ? null : prev);
      } else {
        setError('Erro ao remover documento');
      }

      return success;
    } catch (err) {
      const errorMessage = 'Erro ao remover documento';
      setError(errorMessage);

      logger.errorWithException(
        errorMessage,
        err as Error,
        'useProcessDocuments.deleteDocumentById',
        { documentId }
      );

      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Obtém estatísticas de lançamentos vinculados a um documento
   */
  const getDocumentStatistics = useCallback(async (documentId: string) => {
    try {
      return await ProcessDocumentService.getDocumentStatistics(documentId);
    } catch (err) {
      logger.errorWithException(
        'Erro ao obter estatísticas do documento',
        err as Error,
        'useProcessDocuments.getDocumentStatistics',
        { documentId }
      );
      return {
        decisions_count: 0,
        verbas_count: 0,
        documentos_count: 0,
        total_count: 0
      };
    }
  }, []);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Effect para carregar documento inicial se processId fornecido
   */
  useEffect(() => {
    if (initialProcessId) {
      loadDocument(initialProcessId);
    }
  }, [initialProcessId, loadDocument]);

  return {
    document,
    documents,
    isLoading,
    error,
    uploadProgress,
    loadDocument,
    loadDocuments,
    uploadDocument,
    deleteDocument,
    deleteDocumentById,
    getDocumentStatistics,
    clearError
  };
};

export default useProcessDocuments;
