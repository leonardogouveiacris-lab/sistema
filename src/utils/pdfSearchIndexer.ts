import type { PageTextContent, SearchRect } from './pdfTextExtractor';

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const CONTEXT_RADIUS = 40;

const normalizeChar = (value: string): string =>
  value.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();

const normalizeQuery = (value: string): string => {
  let normalized = '';
  let previousWasSpace = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (/\s/u.test(char)) {
      if (previousWasSpace) continue;
      normalized += ' ';
      previousWasSpace = true;
      continue;
    }

    previousWasSpace = false;
    normalized += normalizeChar(char);
  }

  return normalized.trim();
};

const normalizeWithMap = (text: string): { normalized: string; indexMap: number[] } => {
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
    const cleaned = normalizeChar(char);
    for (let j = 0; j < cleaned.length; j += 1) {
      normalized += cleaned[j];
      indexMap.push(i);
    }
  }

  return { normalized, indexMap };
};

const collectRectsForMatch = (
  page: PageTextContent,
  matchStart: number,
  matchEnd: number
): SearchRect[] => {
  if (!page.items || page.items.length === 0) return [];

  const rects: SearchRect[] = [];

  for (const item of page.items) {
    if (typeof item.startOffset !== 'number' || typeof item.endOffset !== 'number') {
      continue;
    }

    if (item.endOffset <= matchStart || item.startOffset >= matchEnd) {
      continue;
    }

    rects.push({
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height
    });
  }

  return rects;
};

export interface PageSearchMatch {
  matchStart: number;
  matchEnd: number;
  matchText: string;
  contextBefore: string;
  contextAfter: string;
  rects: SearchRect[];
}

export const findPageSearchMatches = (page: PageTextContent, query: string): PageSearchMatch[] => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const { normalized, indexMap } = normalizeWithMap(page.text || '');
  if (!normalized) {
    return [];
  }

  const results: PageSearchMatch[] = [];
  let searchStart = 0;

  while (searchStart <= normalized.length - normalizedQuery.length) {
    const matchIndex = normalized.indexOf(normalizedQuery, searchStart);
    if (matchIndex === -1) {
      break;
    }

    const matchStart = indexMap[matchIndex];
    const matchEndIndex = indexMap[matchIndex + normalizedQuery.length - 1];

    if (matchStart !== undefined && matchEndIndex !== undefined) {
      const matchEnd = matchEndIndex + 1;
      const matchText = page.text.slice(matchStart, matchEnd);
      const contextBefore = page.text.slice(Math.max(0, matchStart - CONTEXT_RADIUS), matchStart);
      const contextAfter = page.text.slice(matchEnd, Math.min(page.text.length, matchEnd + CONTEXT_RADIUS));

      results.push({
        matchStart,
        matchEnd,
        matchText,
        contextBefore,
        contextAfter,
        rects: collectRectsForMatch(page, matchStart, matchEnd)
      });
    }

    searchStart = matchIndex + 1;
  }

  return results;
};
