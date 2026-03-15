import { pdfjs } from 'react-pdf';
import { createWorker } from 'tesseract.js';
import logger from './logger';
import type { OcrPageResult, OcrWordBox } from '../services/pdfOcr.service';

const OCR_RENDER_SCALE = 3.0;

export interface OcrEngineProgress {
  currentPage: number;
  totalPages: number;
  status: 'rendering' | 'recognizing' | 'saving';
}

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null;
let workerInitializing = false;
let workerInitQueue: Array<(w: Awaited<ReturnType<typeof createWorker>>) => void> = [];

async function getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (workerInstance) return workerInstance;

  if (workerInitializing) {
    return new Promise((resolve) => {
      workerInitQueue.push(resolve);
    });
  }

  workerInitializing = true;

  const worker = await createWorker('por', 1, {
    logger: () => {},
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    cacheMethod: 'lsread',
  });

  await worker.setParameters({
    tessedit_pageseg_mode: '3',
    tessedit_ocr_engine_mode: '3',
    preserve_interword_spaces: '1',
  });

  workerInstance = worker;
  workerInitializing = false;

  for (const resolve of workerInitQueue) {
    resolve(worker);
  }
  workerInitQueue = [];

  return worker;
}

export async function terminateOcrWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
    workerInitializing = false;
    workerInitQueue = [];
  }
}

function preprocessCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = source.width;
  dst.height = source.height;
  const ctx = dst.getContext('2d');
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
    const sharpened = contrast > 160 ? 255 : contrast < 80 ? 0 : contrast;
    d[i] = sharpened;
    d[i + 1] = sharpened;
    d[i + 2] = sharpened;
  }

  ctx.putImageData(imageData, 0, 0);
  return dst;
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
  if (!ctx) throw new Error(`Failed to get 2D context for page ${pageNumber}`);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return preprocessCanvas(canvas);
}

async function recognizeCanvasText(
  canvas: HTMLCanvasElement
): Promise<{ text: string; confidence: number; wordBoxes: OcrWordBox[] }> {
  const worker = await getWorker();
  const result = await worker.recognize(canvas);
  const { data } = result;

  const wordBoxes: OcrWordBox[] = [];

  for (const word of data.words) {
    if (!word.text.trim()) continue;
    const conf = word.confidence ?? 0;
    if (conf < 25) continue;

    const { x0, y0, x1, y1 } = word.bbox;
    wordBoxes.push({
      text: word.text,
      x: x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
    });
  }

  return {
    text: data.text ?? '',
    confidence: data.confidence ?? 0,
    wordBoxes,
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

  await getWorker();

  for (let i = 0; i < pageNumbers.length; i++) {
    if (abortSignal?.aborted) break;

    const pageNumber = pageNumbers[i];

    try {
      onProgress?.({ currentPage: i + 1, totalPages: total, status: 'rendering' });

      const canvas = await renderPageToCanvas(pdfDocument, pageNumber);

      if (abortSignal?.aborted) break;

      onProgress?.({ currentPage: i + 1, totalPages: total, status: 'recognizing' });

      const { text, confidence, wordBoxes } = await recognizeCanvasText(canvas);

      results.push({
        pageNumber,
        text,
        confidence,
        wordBoxes,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });

      logger.info(
        `OCR page ${pageNumber}: ${text.length} chars, confidence ${confidence}%, words ${wordBoxes.length}`,
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
