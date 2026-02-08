export interface DocumentoLancamento {
  id: string;
  processId: string;
  tipoDocumento: string;
  comentarios?: string;
  paginaVinculada?: number;
  processDocumentId?: string;
  dataCriacao: Date;
  dataAtualizacao: Date;
}

export interface DocumentoLancamentoCreateInput {
  processId: string;
  tipoDocumento: string;
  comentarios?: string;
  paginaVinculada?: number;
  processDocumentId?: string;
}

export interface DocumentoLancamentoUpdateInput {
  tipoDocumento?: string;
  comentarios?: string;
  paginaVinculada?: number;
  processDocumentId?: string;
}
