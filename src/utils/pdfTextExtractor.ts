import { pdfjs } from 'react-pdf';
import logger from './logger';
import { getCachedDocument, cacheDocument, loadFromDatabase, persistToDatabase } from './pdfTextCache';

function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number[];
  startOffset: number;
  endOffset: number;
}

export interface PageTextContent {
  pageNumber: number;
  text: string;
  items: TextItem[];
}

export interface DocumentTextCache {
  documentId: string;
  pages: Map<number, PageTextContent>;
}

export interface SearchRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SearchResult {
  documentId: string;
  documentIndex: number;
  globalPageNumber: number;
  localPageNumber: number;
  matchIndex: number;
  matchStart: number;
  matchEnd: number;
  contextBefore: string;
  matchText: string;
  contextAfter: string;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
}

const textCache = new Map<string, DocumentTextCache>();

export function getDocumentTextCache(documentId: string): DocumentTextCache | null {
  return textCache.get(documentId) ?? null;
}

async function extractPageText(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumber: number
): Promise<PageTextContent> {
  try {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1, rotation: page.rotate || 0 });

    const items: TextItem[] = [];
    let fullText = '';

    for (const item of textContent.items) {
      if ('str' in item && item.str) {
        const textItem = item as any;
        const x = textItem.transform?.[4] || 0;
        const y = textItem.transform?.[5] || 0;
        const width = textItem.width || 0;
        const height = textItem.height || 0;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([x, y, x + width, y + height]);
        const rectX = Math.min(x1, x2);
        const rectY = Math.min(y1, y2);
        const rectWidth = Math.abs(x2 - x1);
        const rectHeight = Math.abs(y2 - y1);
        const text = textItem.str;
        const startOffset = fullText.length;
        fullText += `${text} `;
        const endOffset = fullText.length - 1;
        items.push({
          text,
          x: rectX,
          y: rectY,
          width: rectWidth,
          height: rectHeight,
          transform: textItem.transform || [],
          startOffset,
          endOffset
        });
      }
    }

    return {
      pageNumber,
      text: fullText.trim(),
      items
    };
  } catch (error) {
    logger.error(
      `Error extracting text from page ${pageNumber}`,
      'pdfTextExtractor.extractPageText',
      error
    );
    return {
      pageNumber,
      text: '',
      items: []
    };
  }
}

export async function extractAllPagesText(
  pdfDocument: pdfjs.PDFDocumentProxy,
  documentId: string,
  onProgress?: (current: number, total: number) => void,
  abortSignal?: AbortSignal,
  options?: {
    priorityPages?: number[];
    progressIntervalPages?: number;
  }
): Promise<DocumentTextCache> {
  const existing = textCache.get(documentId);
  if (existing && existing.pages.size === pdfDocument.numPages) {
    logger.info(
      `Using memory cached text for document ${documentId}`,
      'pdfTextExtractor.extractAllPagesText'
    );
    return existing;
  }

  const dbCache = await loadFromDatabase(documentId);
  if (dbCache && dbCache.pages.size === pdfDocument.numPages) {
    textCache.set(documentId, dbCache);
    logger.info(
      `Using database cached text for document ${documentId}`,
      'pdfTextExtractor.extractAllPagesText'
    );
    if (onProgress) {
      onProgress(pdfDocument.numPages, pdfDocument.numPages);
    }
    return dbCache;
  }

  const persistedCache = await getCachedDocument(documentId);
  if (persistedCache && persistedCache.pages.size === pdfDocument.numPages) {
    textCache.set(documentId, persistedCache);
    logger.info(
      `Using IndexedDB cached text for document ${documentId}`,
      'pdfTextExtractor.extractAllPagesText'
    );
    if (onProgress) {
      onProgress(pdfDocument.numPages, pdfDocument.numPages);
    }
    persistToDatabase(persistedCache).catch(() => {});
    return persistedCache;
  }

  const cache: DocumentTextCache = {
    documentId,
    pages: new Map()
  };

  const numPages = pdfDocument.numPages;
  const BATCH_CONCURRENCY = 4;
  const progressInterval = Math.max(1, options?.progressIntervalPages ?? 4);
  const priorityPages = Array.from(new Set((options?.priorityPages || [])
    .filter(page => Number.isInteger(page) && page >= 1 && page <= numPages)));

  const orderedPages = [
    ...priorityPages,
    ...Array.from({ length: numPages }, (_, index) => index + 1)
      .filter(page => !priorityPages.includes(page))
  ];

  let processedPages = 0;
  let lastProgressReport = 0;

  for (let batchStart = 0; batchStart < orderedPages.length; batchStart += BATCH_CONCURRENCY) {
    if (abortSignal?.aborted) {
      logger.info(
        `Text extraction aborted for document ${documentId} at batch ${batchStart}`,
        'pdfTextExtractor.extractAllPagesText'
      );
      return cache;
    }

    const batch = orderedPages.slice(batchStart, batchStart + BATCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(pageNumber => extractPageText(pdfDocument, pageNumber))
    );

    for (const pageContent of results) {
      cache.pages.set(pageContent.pageNumber, pageContent);
      processedPages += 1;
    }

    if (onProgress && (processedPages - lastProgressReport >= progressInterval || processedPages === numPages)) {
      onProgress(processedPages, numPages);
      lastProgressReport = processedPages;
      textCache.set(documentId, cache);
    }

    await yieldToMain();
  }

  textCache.set(documentId, cache);
  cacheDocument(cache).catch(() => {});
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      persistToDatabase(cache).catch(() => {});
    }, { timeout: 5000 });
  } else {
    setTimeout(() => {
      persistToDatabase(cache).catch(() => {});
    }, 1000);
  }

  logger.success(
    `Extracted text from ${numPages} pages of document ${documentId}`,
    'pdfTextExtractor.extractAllPagesText'
  );

  return cache;
}

export async function getCachedDocumentText(documentId: string): Promise<DocumentTextCache | null> {
  const memoryCache = textCache.get(documentId);
  if (memoryCache) {
    return memoryCache;
  }

  const persistedCache = await getCachedDocument(documentId);
  if (persistedCache) {
    textCache.set(documentId, persistedCache);
    return persistedCache;
  }

  const dbCache = await loadFromDatabase(documentId);
  if (dbCache) {
    textCache.set(documentId, dbCache);
    return dbCache;
  }

  return null;
}
