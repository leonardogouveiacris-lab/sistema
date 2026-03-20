import { pdfjs } from 'react-pdf';
import logger from './logger';
import type { OcrPageResult, OcrWordBox } from '../services/pdfOcr.service';

export const OCR_RENDER_SCALE_DEFAULT = 3.0;

export interface OcrParams {
  renderScale: number;
  pageSegMode: '1' | '3' | '4' | '6' | '11' | '12';
  language: 'por' | 'por+eng';
  confidenceThreshold: number;
}

export const OCR_PARAMS_DEFAULT: OcrParams = {
  renderScale: OCR_RENDER_SCALE_DEFAULT,
  pageSegMode: '3',
  language: 'por+eng',
  confidenceThreshold: 20,
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

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

function applyAdaptiveBinarization(gray: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const blockSize = Math.max(15, Math.round(Math.min(width, height) * 0.025));
  const halfBlock = Math.floor(blockSize / 2);
  const C = 8;

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
  if (!outCtx) throw new Error('Failed to get 2D context for binarization output');

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

function removeNoise(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      if (copy[idx] === 0) {
        let darkNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (copy[nIdx] === 0) darkNeighbors++;
          }
        }
        if (darkNeighbors <= 1) {
          data[idx] = data[idx + 1] = data[idx + 2] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function preprocessCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context for preprocessing');

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const src = imageData.data;

  const gray = new Uint8Array(width * height);
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < gray.length; i++) {
    const lum = Math.round(0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]);
    gray[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const range = maxLum - minLum;
  if (range >= 5) {
    const factor = 255 / range;
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.min(255, Math.round((gray[i] - minLum) * factor));
    }
  }

  const binarized = applyAdaptiveBinarization(gray, width, height);
  removeNoise(binarized);
  return binarized;
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

  const renderTask = page.render({ canvasContext: ctx, viewport });

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
    .replace(/\b(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})\b/g, '$1-$2.$3.$4.$5.$6')
    .replace(/\b(\d{3})[.,](\d{3})[.,](\d{3})[\/\-](\d{4})[\/\-](\d{2})\b/g, '$1.$2.$3/$4-$5')
    .replace(/\b(\d{3})[.,](\d{3})[.,](\d{3})[.,\-](\d{2})\b/g, '$1.$2.$3-$4')
    .replace(/\b(\d{5})[.,\-](\d{3})\b/g, '$1-$2')
    .replace(/\bR\s*\$\s*/g, 'R$ ')
    .replace(/\b(\d{2})\s*[\.\-]\s*(\d{4,5})\s*[\.\-]\s*(\d{4})\b/g, '($1) $2-$3')
    .replace(/\b\((\d{2})\)\s*(\d{4,5})\s*[\.\-]\s*(\d{4})\b/g, '($1) $2-$3');

  result = result
    .replace(/\bfi(?=[a-z])/g, 'fi')
    .replace(/\bfl(?=[a-z])/g, 'fl')
    .replace(/\brn\b/g, 'm')
    .replace(/([A-Z])\|([A-Z])/g, '$1I$2')
    .replace(/\b0([A-Za-z])/g, 'O$1')
    .replace(/\bl([0-9])/g, '1$1')
    .replace(/\b([0-9])l\b/g, '$11')
    .replace(/\bI([0-9])/g, '1$1')
    .replace(/([a-z])1\b/g, '$1l')
    .replace(/\bS([0-9])/g, '5$1');

  result = result
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

async function runTesseract(
  worker: import('tesseract.js').Worker,
  canvas: HTMLCanvasElement,
  confidenceThreshold: number,
  renderScale: number
): Promise<{ text: string; confidence: number; wordBoxes: OcrWordBox[] }> {
  const result = await worker.recognize(canvas);
  const rawText = result.data.text.trim();
  const text = postProcessText(rawText);
  const confidence = result.data.confidence;

  const wordBoxes: OcrWordBox[] = [];
  const rs = renderScale;
  for (const word of result.data.words) {
    const wordText = word.text.trim();
    if (!wordText || word.confidence < confidenceThreshold) continue;
    wordBoxes.push({
      text: wordText,
      x: word.bbox.x0 / rs,
      y: word.bbox.y0 / rs,
      w: (word.bbox.x1 - word.bbox.x0) / rs,
      h: (word.bbox.y1 - word.bbox.y0) / rs,
    });
  }

  return { text, confidence, wordBoxes };
}

export async function runOcrOnPages(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumbers: number[],
  params: OcrParams = OCR_PARAMS_DEFAULT,
  onProgress?: (progress: OcrEngineProgress) => void,
  onPageComplete?: (result: OcrPageResult) => Promise<void> | void,
  abortSignal?: AbortSignal
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = [];
  const total = pageNumbers.length;
  if (total === 0) return results;

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(params.language, 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
    logger: () => {},
  });

  const estimatedDpi = Math.round(params.renderScale * 72);

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: params.pageSegMode,
      preserve_interword_spaces: '1',
      user_defined_dpi: String(estimatedDpi),
    } as Record<string, string>);

    let pendingRender: Promise<HTMLCanvasElement> | null = null;

    pendingRender = renderPageToCanvas(pdfDocument, pageNumbers[0], params.renderScale, abortSignal);

    for (let i = 0; i < pageNumbers.length; i++) {
      if (abortSignal?.aborted) break;

      const pageNumber = pageNumbers[i];

      try {
        onProgress?.({ currentPage: i + 1, totalPages: total, status: 'rendering' });

        const renderedCanvas = await pendingRender!;

        if (i + 1 < pageNumbers.length && !abortSignal?.aborted) {
          pendingRender = renderPageToCanvas(pdfDocument, pageNumbers[i + 1], params.renderScale, abortSignal);
        } else {
          pendingRender = null;
        }

        if (abortSignal?.aborted) {
          releaseCanvas(renderedCanvas);
          break;
        }

        onProgress?.({ currentPage: i + 1, totalPages: total, status: 'preprocessing' });

        let processedCanvas: HTMLCanvasElement;
        try {
          processedCanvas = preprocessCanvas(renderedCanvas);
        } finally {
          releaseCanvas(renderedCanvas);
        }

        onProgress?.({ currentPage: i + 1, totalPages: total, status: 'recognizing' });

        let text = '';
        let confidence = 0;
        let wordBoxes: OcrWordBox[] = [];
        try {
          const recognized = await runTesseract(worker, processedCanvas, params.confidenceThreshold, params.renderScale);
          text = recognized.text;
          confidence = recognized.confidence;
          wordBoxes = recognized.wordBoxes;
        } finally {
          releaseCanvas(processedCanvas);
        }

        const pageResult: OcrPageResult = { pageNumber, text, confidence, wordBoxes };
        results.push(pageResult);

        await onPageComplete?.(pageResult);

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
        const failedResult: OcrPageResult = { pageNumber, text: '', confidence: 0, wordBoxes: [] };
        results.push(failedResult);
        await onPageComplete?.(failedResult);
      }
    }
  } finally {
    await worker.terminate();
  }

  return results;
}
