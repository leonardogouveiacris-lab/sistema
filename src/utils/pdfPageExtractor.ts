import { PDFDocument } from 'pdf-lib';
import logger from './logger';

export interface PageRange {
  start: number;
  end: number;
}

export interface ExtractionProgress {
  phase: 'loading' | 'extracting' | 'generating';
  current: number;
  total: number;
  message: string;
}

export interface ExtractionSourceDocument {
  documentId: string;
  url?: string;
  globalStart: number;
  globalEnd: number;
  pageCount: number;
}

export interface GlobalPageSelection {
  globalPage: number;
  documentId: string;
  localPage: number;
}

export function parsePageRanges(input: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);

  const createValidationError = (part: string) =>
    new Error(`Intervalo de paginas invalido: "${part}". Use valores entre 1 e ${totalPages}.`);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        throw createValidationError(part);
      }

      if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
        throw createValidationError(part);
      }

      const actualStart = Math.min(start, end);
      const actualEnd = Math.max(start, end);

      for (let i = actualStart; i <= actualEnd; i++) {
        pages.add(i);
      }
    } else {
      const page = parseInt(part, 10);

      if (isNaN(page) || page < 1 || page > totalPages) {
        throw createValidationError(part);
      }

      pages.add(page);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return '';

  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }

  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
  return ranges.join(', ');
}

export async function extractPagesFromPDF(
  pdfUrl: string,
  pagesToExtract: number[],
  onProgress?: (progress: ExtractionProgress) => void,
  sourcePdfBuffer?: ArrayBuffer
): Promise<Uint8Array> {
  if (pagesToExtract.length === 0) {
    throw new Error('Nenhuma página selecionada para extração');
  }

  onProgress?.({
    phase: 'loading',
    current: 0,
    total: 100,
    message: 'Carregando documento original...'
  });

  const pdfBytes = sourcePdfBuffer ?? await (async () => {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Erro ao carregar PDF: ${response.statusText}`);
    }

    return response.arrayBuffer();
  })();

  onProgress?.({
    phase: 'loading',
    current: 50,
    total: 100,
    message: 'Processando documento...'
  });

  const sourcePdf = await PDFDocument.load(pdfBytes);
  const totalSourcePages = sourcePdf.getPageCount();

  const validPages = pagesToExtract.filter(p => p >= 1 && p <= totalSourcePages);
  if (validPages.length === 0) {
    throw new Error('Nenhuma página válida para extração');
  }

  const pageIndices = validPages.map(page => page - 1);

  onProgress?.({
    phase: 'extracting',
    current: 0,
    total: validPages.length,
    message: 'Extraindo páginas...'
  });

  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
  const progressBatchSize = Math.max(1, Math.floor(validPages.length / 10));

  for (let i = 0; i < copiedPages.length; i++) {
    newPdf.addPage(copiedPages[i]);

    const shouldUpdateProgress =
      i === copiedPages.length - 1 ||
      (i + 1) % progressBatchSize === 0;

    if (!shouldUpdateProgress) {
      continue;
    }

    onProgress?.({
      phase: 'extracting',
      current: i + 1,
      total: validPages.length,
      message: `Extraindo página ${validPages[i]}...`
    });
  }

  onProgress?.({
    phase: 'generating',
    current: 0,
    total: 100,
    message: 'Gerando novo documento...'
  });

  const newPdfBytes = await newPdf.save();

  onProgress?.({
    phase: 'generating',
    current: 100,
    total: 100,
    message: 'Concluído!'
  });

  return newPdfBytes;
}

export function partitionGlobalPagesBySource(
  pagesToExtract: number[],
  sourceDocuments: ExtractionSourceDocument[],
  totalPages: number
): GlobalPageSelection[] {
  if (pagesToExtract.length === 0) {
    return [];
  }

  const validDocuments = sourceDocuments
    .filter((source) => source.url && source.pageCount > 0)
    .sort((a, b) => a.globalStart - b.globalStart);

  return pagesToExtract
    .map((globalPage) => {
      if (globalPage < 1 || globalPage > totalPages) {
        throw new Error(`Pagina ${globalPage} excede o total de ${totalPages}`);
      }

      const source = validDocuments.find((doc) => globalPage >= doc.globalStart && globalPage <= doc.globalEnd);
      if (!source) {
        throw new Error(`Nao foi possivel mapear a pagina global ${globalPage} para um documento de origem`);
      }

      return {
        globalPage,
        documentId: source.documentId,
        localPage: globalPage - source.globalStart + 1,
      };
    })
    .sort((a, b) => a.globalPage - b.globalPage);
}

export async function extractPagesFromMultiplePDFs(
  pagesToExtract: number[],
  sourceDocuments: ExtractionSourceDocument[],
  totalPages: number,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<Uint8Array> {
  if (pagesToExtract.length === 0) {
    throw new Error('Nenhuma página selecionada para extração');
  }

  const selectedPages = partitionGlobalPagesBySource(pagesToExtract, sourceDocuments, totalPages);
  const selectedDocumentIds = Array.from(new Set(selectedPages.map((page) => page.documentId)));

  onProgress?.({
    phase: 'loading',
    current: 0,
    total: selectedDocumentIds.length,
    message: 'Carregando documentos de origem...'
  });

  const sourcePdfByDocumentId = new Map<string, PDFDocument>();

  for (let i = 0; i < selectedDocumentIds.length; i++) {
    const documentId = selectedDocumentIds[i];
    const sourceMetadata = sourceDocuments.find((source) => source.documentId === documentId && source.url);
    if (!sourceMetadata?.url) {
      throw new Error(`Documento de origem indisponivel para extração (${documentId})`);
    }

    const response = await fetch(sourceMetadata.url);
    if (!response.ok) {
      throw new Error(`Erro ao carregar PDF de origem: ${response.statusText}`);
    }

    const pdfBytes = await response.arrayBuffer();
    const pdfDocument = await PDFDocument.load(pdfBytes);
    sourcePdfByDocumentId.set(documentId, pdfDocument);

    onProgress?.({
      phase: 'loading',
      current: i + 1,
      total: selectedDocumentIds.length,
      message: `Carregando documento ${i + 1} de ${selectedDocumentIds.length}...`
    });
  }

  const outputPdf = await PDFDocument.create();

  onProgress?.({
    phase: 'extracting',
    current: 0,
    total: selectedPages.length,
    message: 'Extraindo páginas selecionadas...'
  });

  for (let i = 0; i < selectedPages.length; i++) {
    const selection = selectedPages[i];
    const sourcePdf = sourcePdfByDocumentId.get(selection.documentId);
    if (!sourcePdf) {
      throw new Error(`Documento de origem não carregado (${selection.documentId})`);
    }

    const sourcePageCount = sourcePdf.getPageCount();
    if (selection.localPage < 1 || selection.localPage > sourcePageCount) {
      throw new Error(`Página ${selection.localPage} inválida no documento ${selection.documentId}`);
    }

    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [selection.localPage - 1]);
    outputPdf.addPage(copiedPage);

    onProgress?.({
      phase: 'extracting',
      current: i + 1,
      total: selectedPages.length,
      message: `Extraindo página global ${selection.globalPage}...`
    });
  }

  onProgress?.({
    phase: 'generating',
    current: 0,
    total: 100,
    message: 'Gerando novo documento...'
  });

  const pdfBytes = await outputPdf.save();

  onProgress?.({
    phase: 'generating',
    current: 100,
    total: 100,
    message: 'Concluído!'
  });

  return pdfBytes;
}

export function downloadPDF(pdfBytes: Uint8Array, filename: string): void {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateExtractedFilename(originalName: string, pages: number[]): string {
  const baseName = originalName.replace(/\.pdf$/i, '');
  const pagesSuffix = pages.length === 1
    ? `_p${pages[0]}`
    : `_p${pages[0]}-${pages[pages.length - 1]}`;

  return `${baseName}${pagesSuffix}_extraido.pdf`;
}
