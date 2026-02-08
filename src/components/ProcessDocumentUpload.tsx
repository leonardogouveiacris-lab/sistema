/**
 * Componente ProcessDocumentUpload - Upload e gerenciamento de PDF do processo
 *
 * Funcionalidades:
 * - Área de drag-and-drop para upload de PDF
 * - Input file tradicional como alternativa
 * - Preview do PDF atual
 * - Substituição de PDF existente
 * - Botão para abrir visualizador flutuante
 * - Exibição de informações do arquivo
 */

import React, { useCallback, useState, useRef } from 'react';
import { FileUp, FileText, Trash2, Eye, AlertCircle } from 'lucide-react';
import { useProcessDocuments } from '../hooks/useProcessDocuments';
import { usePDFViewer } from '../contexts/PDFViewerContext';
import { useToast } from '../contexts/ToastContext';
import { DocumentValidation } from '../types/ProcessDocument';
import logger from '../utils/logger';

/**
 * Props do componente
 */
interface ProcessDocumentUploadProps {
  processId: string;
  onUploadSuccess?: () => void;
  onDeleteSuccess?: () => void;
}

/**
 * Componente ProcessDocumentUpload
 */
const ProcessDocumentUpload: React.FC<ProcessDocumentUploadProps> = ({
  processId,
  onUploadSuccess,
  onDeleteSuccess
}) => {
  const {
    document,
    isLoading,
    error,
    uploadProgress,
    loadDocument,
    uploadDocument,
    deleteDocument,
    clearError
  } = useProcessDocuments(processId);

  const { openViewer } = usePDFViewer();
  const toast = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handler para quando arquivo é selecionado
   */
  const handleFileSelect = useCallback(async (file: File) => {
    clearError();

    // Validação do arquivo
    const validation = DocumentValidation.validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo invalido');
      return;
    }

    logger.info(
      `Arquivo selecionado para upload: ${file.name}`,
      'ProcessDocumentUpload.handleFileSelect',
      { fileSize: file.size, processId }
    );

    // Faz upload
    const result = await uploadDocument(processId, file);

    if (result.success) {
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Recarrega documento
      await loadDocument(processId);
    }
  }, [document, uploadDocument, processId, clearError, onUploadSuccess, loadDocument]);

  /**
   * Handler para input file
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  /**
   * Handlers para drag and drop
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  /**
   * Handler para remover documento
   */
  const handleDelete = useCallback(async () => {
    if (!document) return;

    logger.info(
      `Removendo documento: ${document.fileName}`,
      'ProcessDocumentUpload.handleDelete',
      { documentId: document.id, processId }
    );

    const success = await deleteDocument(processId);

    if (success && onDeleteSuccess) {
      onDeleteSuccess();
    }
  }, [document, deleteDocument, processId, onDeleteSuccess]);

  /**
   * Handler para abrir visualizador
   */
  const handleOpenViewer = useCallback(() => {
    if (!document) return;

    logger.info(
      `Abrindo visualizador para documento: ${document.fileName}`,
      'ProcessDocumentUpload.handleOpenViewer',
      { documentId: document.id }
    );

    openViewer(document);
  }, [document, openViewer]);

  /**
   * Handler para clicar na área de upload
   */
  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Se está carregando
  if (isLoading && !uploadProgress) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
          <span className="text-gray-600">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Cabeçalho */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Integra
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Vincule um arquivo PDF para visualização e extração de texto
        </p>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-semibold mb-1">Erro ao fazer upload do documento</p>
            <p className="text-sm text-red-700">{error}</p>
            {error.includes('permissão') && (
              <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2">
                <p className="font-medium mb-1">Possível solução:</p>
                <p>Execute a migration mais recente no Supabase para atualizar as políticas de acesso.</p>
              </div>
            )}
            {error.includes('bucket') && (
              <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2">
                <p className="font-medium mb-1">Possível solução:</p>
                <p>Crie o bucket 'process-documents' no Supabase Storage ou execute as migrações do banco.</p>
              </div>
            )}
          </div>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800 ml-2 text-xl leading-none"
            title="Fechar"
          >
            ×
          </button>
        </div>
      )}

      {/* Se já existe documento */}
      {document ? (
        <div className="space-y-4">
          {/* Informações do documento */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate" title={document.fileName}>
                    {document.fileName}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {DocumentValidation.formatFileSize(document.fileSize)}
                    {' • '}
                    Enviado em {new Date(document.dataCriacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={handleOpenViewer}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors duration-200"
                  title="Visualizar PDF"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors duration-200 disabled:opacity-50"
                  title="Remover documento"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Botão de abrir visualizador */}
          <button
            onClick={handleOpenViewer}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
          >
            <Eye className="w-5 h-5" />
            <span>Abrir Visualizador de PDF</span>
          </button>

          {/* Botão de substituir */}
          <button
            onClick={handleClickUpload}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium border border-gray-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <FileUp className="w-4 h-4" />
            <span>Substituir PDF</span>
          </button>
        </div>
      ) : (
        /* Área de upload */
        <div>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClickUpload}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <FileUp className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-900 mb-1">
              {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo PDF ou clique para selecionar'}
            </p>
            <p className="text-xs text-gray-600">
              Tamanho máximo: 200MB • Apenas arquivos PDF
            </p>
          </div>

          {/* Input file oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Barra de progresso */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Enviando arquivo...</span>
            <span className="text-sm text-gray-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ProcessDocumentUpload);
