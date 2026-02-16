/**
 * Componente ProcessDocumentManager - Gerenciamento de múltiplos PDFs do processo
 *
 * Funcionalidades:
 * - Lista todos os PDFs do processo (Integra Principal, Atualização 1, etc)
 * - Upload de novos PDFs
 * - Visualização, edição e remoção de PDFs
 * - Abertura do visualizador com múltiplos PDFs unificados
 * - Estatísticas de lançamentos vinculados a cada PDF
 */

import React, { useCallback, useState, useRef } from 'react';
import { FileText, Trash2, Eye, AlertCircle, Plus, Info, Download, Loader2 } from 'lucide-react';
import { useProcessDocuments } from '../hooks/useProcessDocuments';
import { usePDFViewer } from '../contexts/PDFViewerContext';
import { useToast } from '../contexts/ToastContext';
import { ProcessDocument, DocumentValidation } from '../types/ProcessDocument';
import { downloadDocument } from '../services/processDocument.service';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { CustomDropdown } from './ui';
import logger from '../utils/logger';

interface ProcessDocumentManagerProps {
  processId: string;
  processNumber: string;
  onUploadSuccess?: () => void;
  onDeleteSuccess?: () => void;
}

const GRAU_CONFIG: Record<string, string> = {
  'ATOrd': '1grau',
  'ROT': '2grau'
};

interface UploadFormData {
  file: File | null;
  documentType: string;
}

const ProcessDocumentManager: React.FC<ProcessDocumentManagerProps> = ({
  processId,
  processNumber,
  onUploadSuccess,
  onDeleteSuccess
}) => {
  const {
    documents,
    isLoading,
    error,
    uploadProgress,
    loadDocuments,
    uploadDocument,
    deleteDocument,
    clearError
  } = useProcessDocuments(processId);

  const { openViewer } = usePDFViewer();
  const toast = useToast();

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState<UploadFormData>({
    file: null,
    documentType: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    clearError();

    const validation = DocumentValidation.validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo invalido');
      return;
    }

    logger.info(
      `Arquivo selecionado: ${file.name}`,
      'ProcessDocumentManager.handleFileSelect',
      { fileSize: file.size, processId }
    );

    setUploadFormData(prev => ({
      ...prev,
      file
    }));
    setShowUploadForm(true);
  }, [processId, clearError, toast]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

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

  const handleConfirmUpload = useCallback(async () => {
    if (!uploadFormData.file || !uploadFormData.documentType) return;

    const grauSuffix = GRAU_CONFIG[uploadFormData.documentType] ? `_${GRAU_CONFIG[uploadFormData.documentType]}` : '';
    const newFileName = `${uploadFormData.documentType}_${processNumber}${grauSuffix}.pdf`;

    const renamedFile = new File([uploadFormData.file], newFileName, {
      type: uploadFormData.file.type,
      lastModified: uploadFormData.file.lastModified
    });

    logger.info(
      `Fazendo upload de PDF: ${renamedFile.name}`,
      'ProcessDocumentManager.handleConfirmUpload',
      { processId, originalName: uploadFormData.file.name, newName: newFileName }
    );

    const result = await uploadDocument(
      processId,
      renamedFile,
      uploadFormData.documentType
    );

    if (result.success) {
      setShowUploadForm(false);
      setUploadFormData({ file: null, documentType: '' });

      if (onUploadSuccess) {
        onUploadSuccess();
      }

      await loadDocuments(processId);
    }
  }, [uploadFormData, uploadDocument, processId, processNumber, onUploadSuccess, loadDocuments]);

  const handleCancelUpload = useCallback(() => {
    setShowUploadForm(false);
    setUploadFormData({ file: null, documentType: '' });
  }, []);

  const handleDelete = useCallback(async (document: ProcessDocument) => {
    logger.info(
      `Removendo documento: ${document.fileName}`,
      'ProcessDocumentManager.handleDelete',
      { documentId: document.id, processId }
    );

    const success = await deleteDocument(processId, document.id);

    if (success) {
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      await loadDocuments(processId);
    }
  }, [deleteDocument, processId, onDeleteSuccess, loadDocuments]);

  const handleOpenViewer = useCallback(() => {
    if (!documents || documents.length === 0) return;

    logger.info(
      `Abrindo visualizador com ${documents.length} documento(s)`,
      'ProcessDocumentManager.handleOpenViewer',
      { processId, documentCount: documents.length }
    );

    openViewer(documents);
  }, [documents, openViewer, processId]);

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDownload = useCallback(async (doc: ProcessDocument) => {
    if (downloadingDocId === doc.id) {
      return;
    }

    setDownloadingDocId(doc.id);

    try {
      const success = await downloadDocument(doc);
      if (!success) {
        toast.error('Erro ao baixar documento');
      }
    } finally {
      setDownloadingDocId(null);
    }
  }, [downloadingDocId, toast]);

  if (isLoading && !uploadProgress && documents.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
          <span className="text-gray-600">Carregando documentos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Documentos do Processo
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Gerencie os PDFs vinculados ao processo (integra e atualizações)
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-semibold mb-1">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
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

      {documents && documents.length > 0 && (
        <>
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>{documents.length}</strong> documento(s) vinculado(s).
              Use o visualizador para criar lançamentos vinculados a cada PDF.
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {documents.map((doc, index) => (
              <div
                key={doc.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">
                          #{index + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {doc.displayName}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-600 truncate mb-2" title={doc.fileName}>
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>
                          {DocumentValidation.formatFileSize(doc.fileSize)}
                        </span>
                        <span>•</span>
                        <span>
                          Upload: {new Date(doc.dataCriacao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => openViewer([doc])}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors duration-200"
                      title="Visualizar este PDF"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingDocId === doc.id}
                      aria-busy={downloadingDocId === doc.id}
                      aria-label={downloadingDocId === doc.id ? 'Baixando documento...' : 'Baixar documento'}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={downloadingDocId === doc.id ? 'Baixando documento...' : 'Baixar documento'}
                    >
                      {downloadingDocId === doc.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-xs">Baixando...</span>
                        </span>
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={isLoading}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors duration-200 disabled:opacity-50"
                      title="Remover documento"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleOpenViewer}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 mb-3"
          >
            <Eye className="w-5 h-5" />
            <span>Abrir Visualizador Unificado ({documents.length} PDF{documents.length > 1 ? 's' : ''})</span>
          </button>
        </>
      )}

      {showUploadForm && uploadFormData.file ? (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Adicionar novo documento
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Arquivo original
                </label>
                <p className="text-sm text-gray-600 bg-white px-3 py-2 rounded border border-gray-200 truncate">
                  {uploadFormData.file.name}
                </p>
              </div>

              <CustomDropdown
                label="Tipo do documento"
                placeholder="Selecione o tipo"
                value={uploadFormData.documentType}
                required={true}
                enumType={DynamicEnumType.TIPO_DOCUMENTO_PDF}
                onChange={(value) => setUploadFormData(prev => ({ ...prev, documentType: value }))}
              />

              {uploadFormData.documentType && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nome final do arquivo
                  </label>
                  <p className="text-sm font-mono text-blue-700 bg-blue-100 px-3 py-2 rounded border border-blue-200 truncate">
                    {(() => {
                      const grauSuffix = GRAU_CONFIG[uploadFormData.documentType] ? `_${GRAU_CONFIG[uploadFormData.documentType]}` : '';
                      return `${uploadFormData.documentType}_${processNumber}${grauSuffix}.pdf`;
                    })()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCancelUpload}
              disabled={isLoading}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium border border-gray-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={isLoading || !uploadFormData.documentType}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              Confirmar Upload
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClickUpload}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <Plus className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-900 mb-1">
              {isDragging ? 'Solte o arquivo aqui' : documents.length > 0 ? 'Adicionar outro PDF' : 'Adicionar primeiro PDF'}
            </p>
            <p className="text-xs text-gray-600">
              Arraste um arquivo PDF ou clique para selecionar
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Tamanho máximo: 200MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

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

export default React.memo(ProcessDocumentManager);
