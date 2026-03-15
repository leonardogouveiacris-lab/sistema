import { pdfjs } from 'react-pdf';
import logger from './logger';
import type { OcrPageResult, OcrWordBox } from '../services/pdfOcr.service';

const OCR_RENDER_SCALE = 2.0;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export interface OcrEngineProgress {
  currentPage: number;
  totalPages: number;
  status: 'rendering' | 'recognizing' | 'saving';
}

async function renderPageToCanvas(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumber: number
): Promise<HTMLCanvasElement> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Failed to get 2D context for page ${pageNumber}`);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas;
}

async function recognizeCanvasText(
  canvas: HTMLCanvasElement,
  pageNumber: number
): Promise<{ text: string; confidence: number; wordBoxes: OcrWordBox[] }> {
  const imageBase64 = canvas.toDataURL('image/png').split(',')[1];

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ocr-page`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageBase64, pageNumber }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR edge function error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  return {
    text: data.text ?? '',
    confidence: data.confidence ?? 95,
    wordBoxes: (data.wordBoxes ?? []) as OcrWordBox[],
  };
}

export async function runOcrOnPages(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumbers: number[],
  onProgress?: (progress: OcrEngineProgress) => void,
  abortSignal?: AbortSignal
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = [];
  const total = pageNumbers.length;

  for (let i = 0; i < pageNumbers.length; i++) {
    if (abortSignal?.aborted) {
      break;
    }

    const pageNumber = pageNumbers[i];

    try {
      onProgress?.({
        currentPage: i + 1,
        totalPages: total,
        status: 'rendering',
      });

      const canvas = await renderPageToCanvas(pdfDocument, pageNumber);

      if (abortSignal?.aborted) {
        break;
      }

      onProgress?.({
        currentPage: i + 1,
        totalPages: total,
        status: 'recognizing',
      });

      const { text, confidence, wordBoxes } = await recognizeCanvasText(canvas, pageNumber);

      results.push({ pageNumber, text, confidence, wordBoxes });

      logger.info(
        `OCR page ${pageNumber}: ${text.length} chars, confidence ${confidence}%`,
        'pdfOcrEngine.runOcrOnPages'
      );
    } catch (error) {
      logger.error(
        `OCR failed for page ${pageNumber}`,
        'pdfOcrEngine.runOcrOnPages',
        { pageNumber },
        error
      );
      results.push({ pageNumber, text: '', confidence: 0, wordBoxes: [] });
    }
  }

  return results;
}
