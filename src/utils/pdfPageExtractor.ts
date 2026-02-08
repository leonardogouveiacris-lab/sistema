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

export function parsePageRanges(input: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const validStart = Math.max(1, Math.min(start, totalPages));
        const validEnd = Math.max(1, Math.min(end, totalPages));
        const actualStart = Math.min(validStart, validEnd);
        const actualEnd = Math.max(validStart, validEnd);

        for (let i = actualStart; i <= actualEnd; i++) {
          pages.add(i);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.add(page);
      }
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
  onProgress?: (progress: ExtractionProgress) => void
): Promise<Uint8Array> {
  if (pagesToExtract.length === 0) {
    throw new Error('Nenhuma página selecionada para extração');
  }

  logger.info(
    `Iniciando extração de ${pagesToExtract.length} páginas`,
    'pdfPageExtractor.extractPagesFromPDF',
    { pages: pagesToExtract }
  );

  onProgress?.({
    phase: 'loading',
    current: 0,
    total: 100,
    message: 'Carregando documento original...'
  });

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Erro ao carregar PDF: ${response.statusText}`);
  }

  const pdfBytes = await response.arrayBuffer();

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

  onProgress?.({
    phase: 'extracting',
    current: 0,
    total: validPages.length,
    message: 'Extraindo páginas...'
  });

  const newPdf = await PDFDocument.create();

  for (let i = 0; i < validPages.length; i++) {
    const pageIndex = validPages[i] - 1;
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
    newPdf.addPage(copiedPage);

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

  logger.success(
    `Extração concluída: ${validPages.length} páginas`,
    'pdfPageExtractor.extractPagesFromPDF'
  );

  return newPdfBytes;
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

  logger.info(
    `PDF baixado: ${filename}`,
    'pdfPageExtractor.downloadPDF'
  );
}

export function generateExtractedFilename(originalName: string, pages: number[]): string {
  const baseName = originalName.replace(/\.pdf$/i, '');
  const pagesSuffix = pages.length === 1
    ? `_p${pages[0]}`
    : `_p${pages[0]}-${pages[pages.length - 1]}`;

  return `${baseName}${pagesSuffix}_extraido.pdf`;
}
