/**
 * Tipos para representar bookmarks/índices de PDFs
 */

export interface PDFBookmark {
  title: string;
  pageNumber: number | null;
  dest: string | null;
  items: PDFBookmark[];
  bold?: boolean;
  italic?: boolean;
  color?: number[];
  documentId?: string;        // ID do documento de origem (para múltiplos PDFs)
  documentIndex?: number;     // Índice do documento na sequência
  documentName?: string;      // Nome de exibição do documento
  isGlobalPage?: boolean;     // Se true, pageNumber já está na numeração global
}

export interface PDFBookmarkFlat {
  title: string;
  pageNumber: number | null;
  level: number;
  hasChildren: boolean;
  isExpanded?: boolean;
}
