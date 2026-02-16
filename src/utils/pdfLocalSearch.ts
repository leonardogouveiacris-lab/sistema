import type { PageTextContent, SearchResult } from './pdfTextExtractor';
import { mergeRectsIntoLines } from './rectMerger';

export interface SearchOptions {
  matchCase: boolean;
  matchWholeWord: boolean;
  matchDiacritics: boolean;
}

interface TextSpan {
  start: number;
  end: number;
  rect: { x: number; y: number; width: number; height: number };
}

interface PageSearchIndex {
  pageNumber: number;
  text: string;
  spans: TextSpan[];
}

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;

const trimTextWithMap = (
  text: string,
  indexMap: number[]
): { trimmed: string; trimmedMap: number[] } => {
  if (!text) {
    return { trimmed: '', trimmedMap: [] };
  }

  let start = 0;
  let end = text.length;

  while (start < end && /\s/u.test(text[start])) {
    start += 1;
  }

  while (end > start && /\s/u.test(text[end - 1])) {
    end -= 1;
  }

  return {
    trimmed: text.slice(start, end),
    trimmedMap: indexMap.slice(start, end)
  };
};

const collapseWhitespace = (text: string): { collapsed: string; indexMap: number[] } => {
  let collapsed = '';
  const indexMap: number[] = [];
  let previousWasSpace = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/\s/u.test(char)) {
      if (previousWasSpace) continue;
      collapsed += ' ';
      indexMap.push(i);
      previousWasSpace = true;
      continue;
    }

    previousWasSpace = false;
    collapsed += char;
    indexMap.push(i);
  }

  const { trimmed, trimmedMap } = trimTextWithMap(collapsed, indexMap);
  return { collapsed: trimmed, indexMap: trimmedMap };
};

const normalizeText = (
  text: string,
  options: SearchOptions
): { normalized: string; indexMap: number[] } => {
  const { collapsed, indexMap: collapsedMap } = collapseWhitespace(text);
  let normalized = '';
  const normalizedMap: number[] = [];

  for (let i = 0; i < collapsed.length; i += 1) {
    let char = collapsed[i];
    const originalIndex = collapsedMap[i];

    if (!options.matchDiacritics) {
      char = char.normalize('NFD').replace(DIACRITICS_REGEX, '');
    }

    if (!options.matchCase) {
      char = char.toLowerCase();
    }

    for (let j = 0; j < char.length; j += 1) {
      normalized += char[j];
      normalizedMap.push(originalIndex);
    }
  }

  const { trimmed, trimmedMap } = trimTextWithMap(normalized, normalizedMap);
  return { normalized: trimmed, indexMap: trimmedMap };
};

const isWholeWordMatch = (text: string, start: number, end: number): boolean => {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  const beforeIsWord = before ? WORD_CHAR_REGEX.test(before) : false;
  const afterIsWord = after ? WORD_CHAR_REGEX.test(after) : false;
  return !beforeIsWord && !afterIsWord;
};

export const buildPageSearchIndex = (page: PageTextContent): PageSearchIndex => {
  if (page.items.length === 0 && page.text) {
    return {
      pageNumber: page.pageNumber,
      text: page.text,
      spans: []
    };
  }

  let text = '';
  const spans: TextSpan[] = [];
  let cursor = 0;

  page.items.forEach((item) => {
    if (!item.text) return;
    const start = cursor;
    const end = start + item.text.length;
    spans.push({
      start,
      end,
      rect: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
      }
    });
    text += item.text + ' ';
    cursor = end + 1;
  });

  return { pageNumber: page.pageNumber, text: text.trim(), spans };
};

const calculatePartialRect = (
  span: TextSpan,
  matchStart: number,
  matchEnd: number
): { x: number; y: number; width: number; height: number } => {
  const spanLength = span.end - span.start;
  if (spanLength <= 0) return span.rect;

  const overlapStart = Math.max(span.start, matchStart);
  const overlapEnd = Math.min(span.end, matchEnd);
  const overlapLength = overlapEnd - overlapStart;

  if (overlapLength <= 0) return span.rect;

  const charWidth = span.rect.width / spanLength;
  const startOffset = overlapStart - span.start;
  const xOffset = startOffset * charWidth;

  return {
    x: span.rect.x + xOffset,
    y: span.rect.y,
    width: overlapLength * charWidth,
    height: span.rect.height
  };
};

export const searchPage = (
  pageIndex: PageSearchIndex,
  query: string,
  options: SearchOptions
): Array<{ matchStart: number; matchEnd: number; matchText: string; rects: Array<{ x: number; y: number; width: number; height: number }> }> => {
  const { normalized: normalizedQuery } = normalizeText(query, options);
  if (!normalizedQuery) return [];

  const { normalized: normalizedText, indexMap } = normalizeText(pageIndex.text, options);
  if (!normalizedText) return [];

  const matches: Array<{ matchStart: number; matchEnd: number; matchText: string; rects: Array<{ x: number; y: number; width: number; height: number }> }> = [];
  let searchStart = 0;
  let matchIdx = normalizedText.indexOf(normalizedQuery, searchStart);

  while (matchIdx !== -1) {
    const matchEndIdx = matchIdx + normalizedQuery.length;
    if (!options.matchWholeWord || isWholeWordMatch(normalizedText, matchIdx, matchEndIdx)) {
      const originalStart = indexMap[matchIdx];
      const originalEnd = indexMap[matchEndIdx - 1] + 1;

      const rects = pageIndex.spans.length > 0
        ? mergeRectsIntoLines(
          pageIndex.spans
            .filter(span => span.end > originalStart && span.start < originalEnd)
            .map(span => calculatePartialRect(span, originalStart, originalEnd))
        )
        : [];

      matches.push({
        matchStart: originalStart,
        matchEnd: originalEnd,
        matchText: pageIndex.text.slice(originalStart, originalEnd),
        rects
      });
    }

    searchStart = matchIdx + 1;
    matchIdx = normalizedText.indexOf(normalizedQuery, searchStart);
  }

  return matches;
};

export const buildSearchResults = (
  documentId: string,
  documentIndex: number,
  pageIndex: PageSearchIndex,
  query: string,
  options: SearchOptions,
  matchOffset: number,
  globalPageNumber: number
): SearchResult[] => {
  const pageMatches = searchPage(pageIndex, query, options);
  return pageMatches.map((match, idx) => ({
    documentId,
    documentIndex,
    globalPageNumber,
    localPageNumber: pageIndex.pageNumber,
    matchIndex: matchOffset + idx,
    matchStart: match.matchStart,
    matchEnd: match.matchEnd,
    matchText: match.matchText,
    rects: match.rects,
    source: 'local'
  }));
};
