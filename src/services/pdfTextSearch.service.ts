import type { DocumentTextCache, SearchResult, TextItem } from '../utils/pdfTextExtractor';
import { getDocumentTextCache } from '../utils/pdfTextExtractor';
import { mergeRectsIntoLines } from '../utils/rectMerger';

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const CONTEXT_WINDOW = 40;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DocumentOffsetInfo {
  startPage: number;
  endPage: number;
  numPages: number;
}

interface LocalSearchOptions {
  query: string;
  documents: Array<{ id: string }>;
  documentOffsets: Map<string, DocumentOffsetInfo>;
}

interface LocalSearchResponse {
  results: SearchResult[];
  searchedDocumentIds: Set<string>;
  missingDocumentIds: Set<string>;
}

const normalizeWithIndexMap = (text: string): { normalized: string; indexMap: number[] } => {
  let normalized = '';
  const indexMap: number[] = [];
  let previousWasSpace = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/\s/u.test(char)) {
      if (previousWasSpace) continue;
      normalized += ' ';
      indexMap.push(i);
      previousWasSpace = true;
      continue;
    }

    previousWasSpace = false;
    const cleaned = char.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();
    for (let j = 0; j < cleaned.length; j += 1) {
      normalized += cleaned[j];
      indexMap.push(i);
    }
  }

  return { normalized, indexMap };
};

const normalizeQuery = (value: string): string =>
  value.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase().trim();

const buildPageTextFromItems = (items: TextItem[]): { text: string; charRects: Array<Rect | null> } => {
  let text = '';
  const charRects: Array<Rect | null> = [];

  items.forEach((item, index) => {
    const rect = { x: item.x, y: item.y, width: item.width, height: item.height };
    for (let i = 0; i < item.text.length; i += 1) {
      text += item.text[i];
      charRects.push(rect);
    }
    if (index < items.length - 1) {
      text += ' ';
      charRects.push(null);
    }
  });

  return { text, charRects };
};

const hasRenderableItems = (cache: DocumentTextCache): boolean => {
  for (const page of cache.pages.values()) {
    if (page.items.length > 0) {
      return true;
    }
  }
  return false;
};

export const searchLocalPdfText = ({
  query,
  documents,
  documentOffsets
}: LocalSearchOptions): LocalSearchResponse => {
  const normalizedQuery = normalizeQuery(query);
  const results: SearchResult[] = [];
  const searchedDocumentIds = new Set<string>();
  const missingDocumentIds = new Set<string>();

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return { results, searchedDocumentIds, missingDocumentIds };
  }

  documents.forEach((doc, docIndex) => {
    const offsetInfo = documentOffsets.get(doc.id);
    if (!offsetInfo) {
      missingDocumentIds.add(doc.id);
      return;
    }

    const cache = getDocumentTextCache(doc.id);
    if (!cache || cache.pages.size !== offsetInfo.numPages || !hasRenderableItems(cache)) {
      missingDocumentIds.add(doc.id);
      return;
    }

    searchedDocumentIds.add(doc.id);

    for (let pageNumber = 1; pageNumber <= offsetInfo.numPages; pageNumber += 1) {
      const pageContent = cache.pages.get(pageNumber);
      if (!pageContent) {
        continue;
      }

      const { text: rawText, charRects } = pageContent.items.length > 0
        ? buildPageTextFromItems(pageContent.items)
        : { text: pageContent.text, charRects: [] };

      if (!rawText) {
        continue;
      }

      const { normalized, indexMap } = normalizeWithIndexMap(rawText);
      if (!normalized) {
        continue;
      }

      let searchIndex = 0;
      let matchIndex = normalized.indexOf(normalizedQuery, searchIndex);

      while (matchIndex !== -1) {
        const startOriginal = indexMap[matchIndex];
        const endOriginal = indexMap[matchIndex + normalizedQuery.length - 1] + 1;
        const matchText = rawText.slice(startOriginal, endOriginal);
        const contextBefore = rawText.slice(Math.max(0, startOriginal - CONTEXT_WINDOW), startOriginal);
        const contextAfter = rawText.slice(endOriginal, Math.min(rawText.length, endOriginal + CONTEXT_WINDOW));

        let rects: Rect[] = [];
        if (charRects.length > 0) {
          const rectSet = new Map<string, Rect>();
          for (let i = startOriginal; i < endOriginal; i += 1) {
            const rect = charRects[i];
            if (!rect) continue;
            const key = `${rect.x}-${rect.y}-${rect.width}-${rect.height}`;
            if (!rectSet.has(key)) {
              rectSet.set(key, rect);
            }
          }
          rects = mergeRectsIntoLines(Array.from(rectSet.values()));
        }

        results.push({
          documentId: doc.id,
          documentIndex: docIndex,
          globalPageNumber: offsetInfo.startPage + pageNumber - 1,
          localPageNumber: pageNumber,
          matchIndex: results.length,
          matchStart: startOriginal,
          matchEnd: endOriginal,
          contextBefore,
          matchText,
          contextAfter,
          rects
        });

        searchIndex = matchIndex + normalizedQuery.length;
        matchIndex = normalized.indexOf(normalizedQuery, searchIndex);
      }
    }
  });

  return { results, searchedDocumentIds, missingDocumentIds };
};
