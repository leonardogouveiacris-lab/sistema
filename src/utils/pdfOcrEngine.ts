import { pdfjs } from 'react-pdf';
import logger from './logger';
import type { OcrPageResult, OcrWordBox } from '../services/pdfOcr.service';

export const OCR_RENDER_SCALE_DEFAULT = 3.0;
export const OCR_LANGUAGE = 'por';

export interface OcrParams {
  renderScale: number;
  pageSegMode: '1' | '3' | '4' | '6' | '11' | '12';
}

export const OCR_PARAMS_DEFAULT: OcrParams = {
  renderScale: OCR_RENDER_SCALE_DEFAULT,
  pageSegMode: '3',
};

export const PAGE_SEG_MODE_LABELS: Record<OcrParams['pageSegMode'], string> = {
  '1': 'Segmentacao automatica com OSD',
  '3': 'Segmentacao automatica (recomendado)',
  '4': 'Coluna unica de texto',
  '6': 'Bloco uniforme de texto',
  '11': 'Texto esparso',
  '12': 'Texto esparso com OSD',
};

export interface OcrEngineProgress {
  currentPage: number;
  totalPages: number;
  status: 'rendering' | 'preprocessing' | 'recognizing' | 'saving';
}

function applyAdaptiveBinarization(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const blockSize = Math.max(15, Math.round(Math.min(width, height) * 0.03));
  const halfBlock = Math.floor(blockSize / 2);
  const C = 8;

  // Build integral image (summed-area table) for O(1) block mean queries
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      integral[y * (width + 1) + x] =
        gray[(y - 1) * width + (x - 1)] +
        integral[(y - 1) * (width + 1) + x] +
        integral[y * (width + 1) + (x - 1)] -
        integral[(y - 1) * (width + 1) + (x - 1)];
    }
  }

  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const outCtx = output.getContext('2d');
  if (!outCtx) return canvas;

  const outData = outCtx.createImageData(width, height);
  const out = outData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - halfBlock);
      const x1 = Math.min(width - 1, x + halfBlock);
      const y0 = Math.max(0, y - halfBlock);
      const y1 = Math.min(height - 1, y + halfBlock);

      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];

      const mean = sum / count;
      const pixel = gray[y * width + x] < mean - C ? 0 : 255;
      const idx = (y * width + x) * 4;
      out[idx] = pixel;
      out[idx + 1] = pixel;
      out[idx + 2] = pixel;
      out[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return output;
}

function enhanceContrast(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  const range = maxVal - minVal;
  if (range < 10) return;

  const factor = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, Math.round((data[i] - minVal) * factor)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round((data[i + 1] - minVal) * factor)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round((data[i + 2] - minVal) * factor)));
  }

  ctx.putImageData(imageData, 0, 0);
}

function preprocessCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  enhanceContrast(canvas);
  return applyAdaptiveBinarization(canvas);
}

async function renderPageToCanvas(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  renderScale: number,
  abortSignal?: AbortSignal
): Promise<HTMLCanvasElement> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Failed to get 2D context for page ${pageNumber}`);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
  });

  if (abortSignal) {
    const onAbort = () => renderTask.cancel();
    abortSignal.addEventListener('abort', onAbort, { once: true });
    try {
      await renderTask.promise;
    } finally {
      abortSignal.removeEventListener('abort', onAbort);
    }
  } else {
    await renderTask.promise;
  }

  return canvas;
}

function postProcessText(text: string): string {
  let result = text;

  result = result
    .replace(/\b([0-9]{2})\/([0-9]{2})\/([0-9]{2})([0-9]{2})\b/g, '$1/$2/$3$4')
    .replace(/\b(\d{3})[.,](\d{3})[.,](\d{3})[\/\-](\d{4})[\/\-](\d{2})\b/g, '$1.$2.$3/$4-$5')
    .replace(/\b(\d{3})[.,](\d{3})[.,](\d{3})[.,\-](\d{2})\b/g, '$1.$2.$3-$4')
    .replace(/\b(\d{3})[.,](\d{5})[.,](\d{2})[.,](\d)\b/g, '$1.$2.$3/$4');

  result = result
    .replace(/\brn\b/g, 'm')
    .replace(/([A-Z])\|([A-Z])/g, '$1I$2')
    .replace(/\b0([A-Z])/g, 'O$1')
    .replace(/\bl([0-9])/g, '1$1');

  result = result
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

async function recognizeCanvasText(
  worker: import('tesseract.js').Worker,
  canvas: HTMLCanvasElement
): Promise<{ text: string; confidence: number; wordBoxes: OcrWordBox[] }> {
  const processedCanvas = preprocessCanvas(canvas);

  const result = await worker.recognize(processedCanvas);
  const rawText = result.data.text.trim();
  const text = postProcessText(rawText);
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
}

export async function runOcrOnPages(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumbers: number[],
  params: OcrParams = OCR_PARAMS_DEFAULT,
  onProgress?: (progress: OcrEngineProgress) => void,
  abortSignal?: AbortSignal
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = [];
  const total = pageNumbers.length;

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(OCR_LANGUAGE, 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
    logger: () => {},
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: params.pageSegMode,
      preserve_interword_spaces: '1',
    });

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

        const canvas = await renderPageToCanvas(pdfDocument, pageNumber, params.renderScale, abortSignal);

        if (abortSignal?.aborted) {
          break;
        }

        onProgress?.({
          currentPage: i + 1,
          totalPages: total,
          status: 'recognizing',
        });

        const { text, confidence, wordBoxes: rawWordBoxes } = await recognizeCanvasText(worker, canvas);

        const rs = params.renderScale;
        const wordBoxes: OcrWordBox[] = rawWordBoxes.map(wb => ({
          text: wb.text,
          x: wb.x / rs,
          y: wb.y / rs,
          w: wb.w / rs,
          h: wb.h / rs,
        }));

        results.push({ pageNumber, text, confidence, wordBoxes });

        logger.info(
          `OCR page ${pageNumber}: ${text.length} chars, ${wordBoxes.length} words, confidence ${confidence.toFixed(1)}%`,
          'pdfOcrEngine.runOcrOnPages'
        );
      } catch (error) {
        if (abortSignal?.aborted) break;
        logger.error(
          `OCR failed for page ${pageNumber}`,
          'pdfOcrEngine.runOcrOnPages',
          { pageNumber },
          error
        );
        results.push({ pageNumber, text: '', confidence: 0, wordBoxes: [] });
      }
    }
  } finally {
    await worker.terminate();
  }

  return results;
}
