/**
 * Utility for extracting bookmarks/outlines from PDF documents using PDF.js.
 * Limitação: interpretação do destino depende do formato retornado pelo PDF.js;
 * em PDFs não padronizados alguns bookmarks podem ficar sem número de página.
 */

import { PDFBookmark } from '../types/PDFBookmark';
import logger from './logger';

type PDFDestination = unknown[];

interface PDFOutlineItem {
  title?: string;
  dest?: string | PDFDestination | null;
  items?: PDFOutlineItem[];
  bold?: boolean;
  italic?: boolean;
  color?: number[];
}

interface PDFDocumentProxy {
  getOutline: () => Promise<PDFOutlineItem[] | null>;
  getDestination: (dest: string) => Promise<PDFDestination | null>;
  getPageIndex: (ref: unknown) => Promise<number>;
}

/**
 * Informações do documento para extração de bookmarks
 */
export interface DocumentInfo {
  documentId: string;
  documentIndex: number;
  documentName: string;
  pageOffset: number;
}

export async function extractBookmarksWithDocumentInfo(
  pdfDocument: PDFDocumentProxy,
  documentInfo: DocumentInfo
): Promise<PDFBookmark[]> {
  try {
    logger.info(
      `Iniciando extração de bookmarks do documento "${documentInfo.documentName}" (índice ${documentInfo.documentIndex}, offset ${documentInfo.pageOffset})`,
      'pdfBookmarkExtractor.extractBookmarksWithDocumentInfo'
    );

    const outline = await pdfDocument.getOutline();

    if (!outline || outline.length === 0) {
      logger.info(
        `Documento "${documentInfo.documentName}" não possui bookmarks`,
        'pdfBookmarkExtractor.extractBookmarksWithDocumentInfo'
      );
      return [];
    }

    logger.info(
      `Encontrados ${outline.length} bookmarks de primeiro nível no documento "${documentInfo.documentName}"`,
      'pdfBookmarkExtractor.extractBookmarksWithDocumentInfo'
    );

    const bookmarks = await processBookmarkItems(outline, pdfDocument, documentInfo);

    logger.success(
      `Extração de bookmarks do documento "${documentInfo.documentName}" concluída: ${bookmarks.length} items processados`,
      'pdfBookmarkExtractor.extractBookmarksWithDocumentInfo'
    );

    return bookmarks;
  } catch (error) {
    logger.errorWithException(
      `Erro ao extrair bookmarks do documento "${documentInfo.documentName}"`,
      error as Error,
      'pdfBookmarkExtractor.extractBookmarksWithDocumentInfo'
    );
    throw error;
  }
}

const BATCH_SIZE = 25;

async function processBookmarkItems(
  items: PDFOutlineItem[],
  pdfDocument: PDFDocumentProxy,
  documentInfo?: DocumentInfo
): Promise<PDFBookmark[]> {
  const bookmarks: PDFBookmark[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processBookmarkItem(item, pdfDocument, documentInfo);
        } catch {
          const fallbackBookmark: PDFBookmark = {
            title: item.title || 'Item sem título',
            pageNumber: null,
            dest: null,
            items: [],
            bold: item.bold,
            italic: item.italic,
            color: item.color
          };

          if (documentInfo) {
            fallbackBookmark.documentId = documentInfo.documentId;
            fallbackBookmark.documentIndex = documentInfo.documentIndex;
            fallbackBookmark.documentName = documentInfo.documentName;
            fallbackBookmark.isGlobalPage = true;
          }

          return fallbackBookmark;
        }
      })
    );

    bookmarks.push(...batchResults);
  }

  return bookmarks;
}

/**
 * Processa um único item de bookmark
 */
async function processBookmarkItem(
  item: PDFOutlineItem,
  pdfDocument: PDFDocumentProxy,
  documentInfo?: DocumentInfo
): Promise<PDFBookmark> {
  let pageNumber: number | null = null;
  let destString: string | null = null;

  if (item.dest) {
    try {
      let destination = item.dest;

      if (typeof destination === 'string') {
        destString = destination;
        destination = await pdfDocument.getDestination(destination);
      }

      if (Array.isArray(destination) && destination[0]) {
        const pageRef = destination[0];
        const pageIndex = await pdfDocument.getPageIndex(pageRef);
        const localPageNumber = pageIndex + 1;

        pageNumber = documentInfo ? localPageNumber + documentInfo.pageOffset : localPageNumber;
      }
    } catch {
      // Silently handle destination resolution errors
    }
  }

  let childBookmarks: PDFBookmark[] = [];
  if (item.items && Array.isArray(item.items) && item.items.length > 0) {
    childBookmarks = await processBookmarkItems(item.items, pdfDocument, documentInfo);
  }

  const bookmark: PDFBookmark = {
    title: item.title || 'Item sem título',
    pageNumber,
    dest: destString,
    items: childBookmarks,
    bold: item.bold,
    italic: item.italic,
    color: item.color
  };

  if (documentInfo) {
    bookmark.documentId = documentInfo.documentId;
    bookmark.documentIndex = documentInfo.documentIndex;
    bookmark.documentName = documentInfo.documentName;
    bookmark.isGlobalPage = true;
  }

  return bookmark;
}

export function countTotalBookmarks(bookmarks: PDFBookmark[]): number {
  let total = bookmarks.length;

  for (const bookmark of bookmarks) {
    if (bookmark.items && bookmark.items.length > 0) {
      total += countTotalBookmarks(bookmark.items);
    }
  }

  return total;
}

export function flattenBookmarks(
  bookmarks: PDFBookmark[],
  level: number = 0
): Array<{ bookmark: PDFBookmark; level: number }> {
  const flat: Array<{ bookmark: PDFBookmark; level: number }> = [];

  for (const bookmark of bookmarks) {
    flat.push({ bookmark, level });

    if (bookmark.items && bookmark.items.length > 0) {
      flat.push(...flattenBookmarks(bookmark.items, level + 1));
    }
  }

  return flat;
}

export function filterBookmarks(
  bookmarks: PDFBookmark[],
  searchQuery: string
): PDFBookmark[] {
  if (!searchQuery.trim()) {
    return bookmarks;
  }

  const query = searchQuery.toLowerCase();
  const filtered: PDFBookmark[] = [];

  for (const bookmark of bookmarks) {
    const titleMatches = bookmark.title.toLowerCase().includes(query);
    const filteredChildren = bookmark.items.length > 0
      ? filterBookmarks(bookmark.items, searchQuery)
      : [];

    if (titleMatches || filteredChildren.length > 0) {
      filtered.push({
        ...bookmark,
        items: filteredChildren
      });
    }
  }

  return filtered;
}

function applyPageOffsetToBookmarks(bookmarks: PDFBookmark[], offset: number): PDFBookmark[] {
  return bookmarks.map(bookmark => ({
    ...bookmark,
    pageNumber: bookmark.pageNumber !== null ? bookmark.pageNumber + offset : null,
    items: bookmark.items.length > 0 ? applyPageOffsetToBookmarks(bookmark.items, offset) : []
  }));
}

export function mergeBookmarksFromMultipleDocuments(
  bookmarksByDocument: Map<string, { bookmarks: PDFBookmark[]; documentName: string; documentIndex: number; pageCount?: number }>,
  options?: { totalDocumentCount?: number }
): PDFBookmark[] {
  const mergedBookmarks: PDFBookmark[] = [];

  const shouldGroupByDocument = (options?.totalDocumentCount ?? bookmarksByDocument.size) > 1;

  const sortedEntries = Array.from(bookmarksByDocument.entries()).sort(
    (a, b) => a[1].documentIndex - b[1].documentIndex
  );

  let cumulativeOffset = 0;

  for (const [documentId, { bookmarks, documentName, documentIndex, pageCount }] of sortedEntries) {
    const adjustedBookmarks = documentIndex === 0
      ? bookmarks
      : applyPageOffsetToBookmarks(bookmarks, cumulativeOffset);

    if (shouldGroupByDocument) {
      const fallbackFirstPageNumber = pageCount && pageCount > 0 ? cumulativeOffset + 1 : null;
      const separatorBookmark: PDFBookmark = {
        title: documentName,
        pageNumber: adjustedBookmarks[0]?.pageNumber ?? fallbackFirstPageNumber,
        dest: null,
        items: adjustedBookmarks,
        bold: true,
        documentId,
        documentIndex,
        documentName,
        isGlobalPage: true
      };
      mergedBookmarks.push(separatorBookmark);
    } else if (adjustedBookmarks.length > 0) {
      mergedBookmarks.push(...adjustedBookmarks);
    }

    if (pageCount && pageCount > 0) {
      cumulativeOffset += pageCount;
    }
  }

  return mergedBookmarks;
}
