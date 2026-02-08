/**
 * Utility for extracting bookmarks/outlines from PDF documents using PDF.js
 */

import { PDFBookmark } from '../types/PDFBookmark';
import logger from './logger';

interface PDFDocumentProxy {
  getOutline: () => Promise<any[] | null>;
  getDestination: (dest: string) => Promise<any>;
  getPageIndex: (ref: any) => Promise<number>;
}

/**
 * Informações do documento para extração de bookmarks
 */
export interface DocumentInfo {
  documentId: string;
  documentIndex: number;
  documentName: string;
  pageOffset: number; // Offset para converter páginas locais em páginas globais
}

/**
 * Extrai bookmarks de um documento PDF (método legado - mantido para compatibilidade)
 * @param pdfDocument - O documento PDF (PDFDocumentProxy do PDF.js)
 * @returns Array de bookmarks processados
 */
export async function extractBookmarks(pdfDocument: PDFDocumentProxy): Promise<PDFBookmark[]> {
  try {
    logger.info('Iniciando extração de bookmarks', 'pdfBookmarkExtractor.extractBookmarks');

    const outline = await pdfDocument.getOutline();

    if (!outline || outline.length === 0) {
      logger.info('PDF não possui bookmarks', 'pdfBookmarkExtractor.extractBookmarks');
      return [];
    }

    logger.info(
      `Encontrados ${outline.length} bookmarks de primeiro nível`,
      'pdfBookmarkExtractor.extractBookmarks'
    );

    const bookmarks = await processBookmarkItems(outline, pdfDocument);

    logger.success(
      `Extração de bookmarks concluída: ${bookmarks.length} items processados`,
      'pdfBookmarkExtractor.extractBookmarks'
    );

    return bookmarks;
  } catch (error) {
    logger.errorWithException(
      'Erro ao extrair bookmarks do PDF',
      error as Error,
      'pdfBookmarkExtractor.extractBookmarks'
    );
    throw error;
  }
}

/**
 * Extrai bookmarks de um documento PDF com informações do documento e offset de páginas
 * @param pdfDocument - O documento PDF (PDFDocumentProxy do PDF.js)
 * @param documentInfo - Informações do documento (ID, índice, nome, offset)
 * @returns Array de bookmarks processados com numeração global
 */
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
  items: any[],
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
 * @param item - Item do outline
 * @param pdfDocument - Documento PDF
 * @param documentInfo - Informações do documento (opcional)
 * @returns PDFBookmark processado
 */
async function processBookmarkItem(
  item: any,
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

      if (destination && Array.isArray(destination) && destination[0]) {
        const pageRef = destination[0];
        const pageIndex = await pdfDocument.getPageIndex(pageRef);
        const localPageNumber = pageIndex + 1;

        if (documentInfo) {
          pageNumber = localPageNumber + documentInfo.pageOffset;
        } else {
          pageNumber = localPageNumber;
        }
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

  // Adicionar metadados do documento se disponível
  if (documentInfo) {
    bookmark.documentId = documentInfo.documentId;
    bookmark.documentIndex = documentInfo.documentIndex;
    bookmark.documentName = documentInfo.documentName;
    bookmark.isGlobalPage = true;
  }

  return bookmark;
}

/**
 * Conta o total de bookmarks incluindo filhos
 * @param bookmarks - Array de bookmarks
 * @returns Número total de bookmarks
 */
export function countTotalBookmarks(bookmarks: PDFBookmark[]): number {
  let total = bookmarks.length;

  for (const bookmark of bookmarks) {
    if (bookmark.items && bookmark.items.length > 0) {
      total += countTotalBookmarks(bookmark.items);
    }
  }

  return total;
}

/**
 * Achata a estrutura hierárquica de bookmarks em uma lista plana
 * @param bookmarks - Array de bookmarks
 * @param level - Nível de profundidade atual
 * @returns Array de bookmarks achatado com informação de nível
 */
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

/**
 * Filtra bookmarks por texto de busca
 * @param bookmarks - Array de bookmarks
 * @param searchQuery - Texto de busca
 * @returns Array de bookmarks filtrado
 */
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

/**
 * Aplica offset de página a todos os bookmarks de uma estrutura hierárquica
 * @param bookmarks - Array de bookmarks
 * @param offset - Offset a ser adicionado
 * @returns Array de bookmarks com páginas ajustadas
 */
function applyPageOffsetToBookmarks(bookmarks: PDFBookmark[], offset: number): PDFBookmark[] {
  return bookmarks.map(bookmark => ({
    ...bookmark,
    pageNumber: bookmark.pageNumber !== null ? bookmark.pageNumber + offset : null,
    items: bookmark.items.length > 0 ? applyPageOffsetToBookmarks(bookmark.items, offset) : []
  }));
}

/**
 * Mescla bookmarks de múltiplos documentos em uma estrutura unificada
 * Agrupa bookmarks por documento com separadores visuais
 * IMPORTANTE: Recalcula os offsets de página baseado na contagem real de páginas de cada documento
 * para garantir numeração contínua correta mesmo quando documentos carregam em ordem diferente
 * @param bookmarksByDocument - Map de documentId para array de bookmarks com pageCount
 * @returns Array unificado de bookmarks com separadores de documento
 */
export function mergeBookmarksFromMultipleDocuments(
  bookmarksByDocument: Map<string, { bookmarks: PDFBookmark[]; documentName: string; documentIndex: number; pageCount?: number }>
): PDFBookmark[] {
  const mergedBookmarks: PDFBookmark[] = [];

  const sortedEntries = Array.from(bookmarksByDocument.entries()).sort(
    (a, b) => a[1].documentIndex - b[1].documentIndex
  );

  let cumulativeOffset = 0;

  for (const [documentId, { bookmarks, documentName, documentIndex, pageCount }] of sortedEntries) {
    const adjustedBookmarks = documentIndex === 0
      ? bookmarks
      : applyPageOffsetToBookmarks(bookmarks, cumulativeOffset);

    if (adjustedBookmarks.length > 0) {
      if (bookmarksByDocument.size > 1) {
        const firstPageNumber = adjustedBookmarks[0]?.pageNumber || (cumulativeOffset + 1);
        const separatorBookmark: PDFBookmark = {
          title: documentName,
          pageNumber: firstPageNumber,
          dest: null,
          items: adjustedBookmarks,
          bold: true,
          documentId,
          documentIndex,
          documentName,
          isGlobalPage: true
        };
        mergedBookmarks.push(separatorBookmark);
      } else {
        mergedBookmarks.push(...adjustedBookmarks);
      }
    }

    if (pageCount && pageCount > 0) {
      cumulativeOffset += pageCount;
    }
  }

  logger.info(
    `Bookmarks mesclados de ${bookmarksByDocument.size} documento(s): ${countTotalBookmarks(mergedBookmarks)} bookmarks totais`,
    'pdfBookmarkExtractor.mergeBookmarksFromMultipleDocuments'
  );

  return mergedBookmarks;
}
