import { pdfjs } from 'react-pdf';
import logger from './logger';
import type { OcrPageResult, OcrWordBox } from '../services/pdfOcr.service';

const OCR_RENDER_SCALE = 2.0;
const OCR_LANGUAGE = 'por';

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
  canvas: HTMLCanvasElement
): Promise<{ text: string; confidence: number; wordBoxes: OcrWordBox[] }> {
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker(OCR_LANGUAGE, 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
    logger: () => {},
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '1',
    });

    const result = await worker.recognize(canvas);
    const text = result.data.text.trim();
    const confidence = result.data.confidence;

    const wordBoxes: OcrWordBox[] = [];
    for (const word of result.data.words) {
      const wordText = word.text.trim();
      if (!wordText) continue;
      wordBoxes.push({
        text: wordText,
        x: word.bbox.x0,
        y: word.bbox.y0,
        w: word.bbox.x1 - word.bbox.x0,
        h: word.bbox.y1 - word.bbox.y0,
      });
    }

    return { text, confidence, wordBoxes };
  } finally {
    await worker.terminate();
  }
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

      const { text, confidence, wordBoxes } = await recognizeCanvasText(canvas);

      results.push({ pageNumber, text, confidence, wordBoxes });

      logger.info(
        `OCR page ${pageNumber}: ${text.length} chars, ${wordBoxes.length} words, confidence ${confidence.toFixed(1)}%`,
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
