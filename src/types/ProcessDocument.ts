/**
 * Tipos para gerenciamento de documentos PDF vinculados aos processos
 */

import { BaseEntity } from './Common';

/**
 * Interface principal para documentos de processo
 * Representa um PDF vinculado a um processo trabalhista
 */
export interface ProcessDocument extends BaseEntity {
  processId: string;        // ID do processo ao qual o documento pertence
  fileName: string;         // Nome original do arquivo
  filePath: string;         // Caminho no Supabase Storage (formato: process-documents/processId/fileName)
  fileSize: number;         // Tamanho do arquivo em bytes
  mimeType: string;         // Tipo MIME (sempre 'application/pdf')
  sequenceOrder: number;    // Ordem do PDF na sequência (1, 2, 3, ...)
  displayName: string;      // Nome de exibição gerado automaticamente
  url?: string;             // URL pública para acesso ao arquivo (gerada sob demanda)
}

/**
 * Tipo para criação de novo documento
 * Omite campos gerados automaticamente pelo sistema
 */
export type NewProcessDocument = Omit<ProcessDocument, keyof BaseEntity | 'url'>;

/**
 * Tipo para atualização de documento existente
 * Permite atualizar apenas alguns campos
 */
export type UpdateProcessDocument = Partial<NewProcessDocument>;

/**
 * Interface para dados temporários de documento antes do upload
 * Usado para armazenar documento em memória antes de salvar no Supabase
 */
export interface TemporaryDocument {
  processId: string;        // ID do processo
  file: File;              // Objeto File do navegador
  dataUrl: string;         // Data URL para preview (opcional)
}

/**
 * Interface para resultado de upload de documento
 */
export interface DocumentUploadResult {
  success: boolean;
  document?: ProcessDocument;
  error?: string;
}

/**
 * Interface para progresso de upload
 */
export interface UploadProgress {
  loaded: number;          // Bytes carregados
  total: number;           // Total de bytes
  percentage: number;      // Porcentagem (0-100)
}

/**
 * Constantes relacionadas a documentos
 */
export const DOCUMENT_CONSTANTS = {
  MAX_FILE_SIZE: 209715200,          // 200MB em bytes
  ALLOWED_MIME_TYPE: 'application/pdf',
  STORAGE_BUCKET: 'process-documents',
  SESSION_STORAGE_KEY: 'temp_process_documents'
} as const;

/**
 * Interface para estatísticas de lançamentos vinculados a um documento
 */
export interface DocumentStatistics {
  decisionsCount: number;
  verbasCount: number;
  documentosCount: number;
  totalCount: number;
}

/**
 * Interface para coleção de documentos de um processo
 */
export interface ProcessDocumentCollection {
  documents: ProcessDocument[];
  totalDocuments: number;
  totalPages?: number;
}

/**
 * Interface para offset de páginas entre documentos
 */
export interface DocumentPageOffset {
  documentId: string;
  documentIndex: number;
  startPage: number;
  endPage: number;
  pageCount: number;
}

/**
 * Funções auxiliares para validação de documentos
 */
export const DocumentValidation = {
  /**
   * Valida se o arquivo é um PDF válido
   */
  isPDF: (file: File): boolean => {
    return file.type === DOCUMENT_CONSTANTS.ALLOWED_MIME_TYPE;
  },

  /**
   * Valida se o tamanho do arquivo está dentro do limite
   */
  isValidSize: (file: File): boolean => {
    return file.size > 0 && file.size <= DOCUMENT_CONSTANTS.MAX_FILE_SIZE;
  },

  /**
   * Formata o tamanho do arquivo para exibição
   */
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Valida arquivo completo
   */
  validateFile: (file: File): { valid: boolean; error?: string } => {
    if (!DocumentValidation.isPDF(file)) {
      return {
        valid: false,
        error: 'Apenas arquivos PDF são permitidos'
      };
    }

    if (!DocumentValidation.isValidSize(file)) {
      return {
        valid: false,
        error: `O arquivo deve ter no máximo ${DocumentValidation.formatFileSize(DOCUMENT_CONSTANTS.MAX_FILE_SIZE)}`
      };
    }

    return { valid: true };
  }
};
