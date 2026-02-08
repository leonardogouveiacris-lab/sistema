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

  return { collapsed: collapsed.trim(), indexMap };
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

  return { normalized: normalized.trim(), indexMap: normalizedMap };
};

const isWholeWordMatch = (text: string, start: number, end: number): boolean => {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  const beforeIsWord = before ? WORD_CHAR_REGEX.test(before) : false;
  const afterIsWord = after ? WORD_CHAR_REGEX.test(after) : false;
  return !beforeIsWord && !afterIsWord;
};

export const buildPageSearchIndex = (page: PageTextContent): PageSearchIndex => {
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

      const rects = pageIndex.spans
        .filter(span => span.end > originalStart && span.start < originalEnd)
        .map(span => span.rect);

      const mergedRects = mergeRectsIntoLines(rects);
      matches.push({
        matchStart: originalStart,
        matchEnd: originalEnd,
        matchText: pageIndex.text.slice(originalStart, originalEnd),
        rects: mergedRects
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
