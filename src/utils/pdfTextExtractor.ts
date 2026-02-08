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
  rects?: SearchRect[];
}

const textCache = new Map<string, DocumentTextCache>();

async function extractPageText(
  pdfDocument: pdfjs.PDFDocumentProxy,
  pageNumber: number
): Promise<PageTextContent> {
  try {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const items: TextItem[] = [];
    let fullText = '';

    for (const item of textContent.items) {
      if ('str' in item && item.str) {
        const textItem = item as any;
        const startOffset = fullText.length;
        const itemText = textItem.str;
        const endOffset = startOffset + itemText.length;
        items.push({
          text: itemText,
          x: textItem.transform?.[4] || 0,
          y: textItem.transform?.[5] || 0,
          width: textItem.width || 0,
          height: textItem.height || 0,
          transform: textItem.transform || [],
          startOffset,
          endOffset
        });
        fullText += `${itemText} `;
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
  abortSignal?: AbortSignal
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
  const YIELD_INTERVAL = 3;

  for (let i = 1; i <= numPages; i++) {
    if (abortSignal?.aborted) {
      logger.info(
        `Text extraction aborted for document ${documentId} at page ${i}`,
        'pdfTextExtractor.extractAllPagesText'
      );
      return cache;
    }

    const pageContent = await extractPageText(pdfDocument, i);
    cache.pages.set(i, pageContent);
    textCache.set(documentId, { ...cache, pages: new Map(cache.pages) });

    if (onProgress) {
      onProgress(i, numPages);
    }

    if (i % YIELD_INTERVAL === 0) {
      await yieldToMain();
    }
  }

  textCache.set(documentId, cache);
  cacheDocument(cache).catch(() => {});
  persistToDatabase(cache).catch(() => {});

  logger.success(
    `Extracted text from ${numPages} pages of document ${documentId}`,
    'pdfTextExtractor.extractAllPagesText'
  );

  return cache;
}

export function getCachedDocumentText(documentId: string): DocumentTextCache | null {
  return textCache.get(documentId) || null;
}
