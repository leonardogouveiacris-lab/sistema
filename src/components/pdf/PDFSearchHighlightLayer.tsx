import React, { useMemo, useEffect, useRef, useState, memo } from 'react';
import logger from '../../utils/logger';

interface SearchResultItem {
  globalPageNumber: number;
  matchIndex: number;
  matchStart: number;
  matchText?: string;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
}

interface PDFSearchHighlightLayerProps {
  pageNumber: number;
  scale: number;
  documentId: string;
  localPageNumber: number;
  searchResults: SearchResultItem[];
  currentSearchIndex: number;
  searchQuery: string;
}

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_RETRY_ATTEMPTS = 20;
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const normalizeString = (text: string): string => {
  let normalized = '';
  let previousWasSpace = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/\s/u.test(char)) {
      if (previousWasSpace) continue;
      normalized += ' ';
      previousWasSpace = true;
      continue;
    }

    previousWasSpace = false;
    const cleaned = char.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();
    normalized += cleaned;
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
    const cleaned = char.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();
    for (let j = 0; j < cleaned.length; j += 1) {
      normalized += cleaned[j];
      indexMap.push(i);
    }
  }

  return { normalized, indexMap };
};

function rectsMapAreEqual(
  map1: Map<number, HighlightRect[]>,
  map2: Map<number, HighlightRect[]>
): boolean {
  if (map1.size !== map2.size) return false;
  for (const [key, rects1] of map1) {
    const rects2 = map2.get(key);
    if (!rects2 || rects1.length !== rects2.length) return false;
    for (let i = 0; i < rects1.length; i++) {
      const r1 = rects1[i];
      const r2 = rects2[i];
      if (r1.x !== r2.x || r1.y !== r2.y || r1.width !== r2.width || r1.height !== r2.height) {
        return false;
      }
    }
  }
  return true;
}

const PDFSearchHighlightLayer: React.FC<PDFSearchHighlightLayerProps> = memo(({
  pageNumber,
  scale,
  searchResults,
  currentSearchIndex,
  searchQuery
}) => {
  const currentResultRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightRects, setHighlightRects] = useState<Map<number, HighlightRect[]>>(new Map());
  const textLayerRef = useRef<Element | null>(null);
  const lastRectsRef = useRef<Map<number, HighlightRect[]>>(new Map());

  const pageResults = useMemo(() => {
    return searchResults.filter(r => r.globalPageNumber === pageNumber);
  }, [searchResults, pageNumber]);

  const currentResultOnPage = useMemo(() => {
    if (currentSearchIndex < 0) return null;
    const currentResult = searchResults[currentSearchIndex];
    if (!currentResult || currentResult.globalPageNumber !== pageNumber) return null;
    return currentResult;
  }, [searchResults, currentSearchIndex, pageNumber]);

  useEffect(() => {
    if (pageResults.length === 0 || !searchQuery) {
      if (lastRectsRef.current.size > 0) {
        lastRectsRef.current = new Map();
        setHighlightRects(new Map());
      }
      return;
    }

    const hasLocalRects = pageResults.every(result => result.rects && result.rects.length > 0);
    if (hasLocalRects) {
      const newRects = new Map<number, HighlightRect[]>();
      pageResults.forEach((result) => {
        newRects.set(result.matchIndex, result.rects || []);
      });
      if (!rectsMapAreEqual(newRects, lastRectsRef.current)) {
        lastRectsRef.current = newRects;
        setHighlightRects(newRects);
      }
      return;
    }

    let retryCount = 0;
    let rafId: number | null = null;

    const computeHighlights = () => {
      let textLayer = textLayerRef.current;

      if (!textLayer || !document.contains(textLayer)) {
        textLayer = document.querySelector(
          `[data-global-page="${pageNumber}"] .textLayer`
        );
        textLayerRef.current = textLayer;
      }

      if (!textLayer) {
        retryCount++;
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          rafId = requestAnimationFrame(computeHighlights);
        }
        return;
      }

      const spans = textLayer.querySelectorAll('span[role="presentation"]');
      if (spans.length === 0) {
        retryCount++;
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          rafId = requestAnimationFrame(computeHighlights);
        }
        return;
      }

      const newRects = new Map<number, HighlightRect[]>();
      const parentRect = textLayer.getBoundingClientRect();
      const searchTerm = normalizeString(searchQuery);
      if (!searchTerm) {
        return;
      }

      const getTextNodeRect = (span: Element, startIdx: number, endIdx: number): DOMRect | null => {
        const textNode = span.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

        try {
          const range = document.createRange();
          range.setStart(textNode, startIdx);
          range.setEnd(textNode, endIdx);
          return range.getBoundingClientRect();
        } catch {
          return null;
        }
      };

      interface MatchInfo {
        span: Element;
        startIdx: number;
        endIdx: number;
        rect: DOMRect;
        normalizedText: string;
      }

      const allMatches: MatchInfo[] = [];

      spans.forEach((span) => {
        const text = span.textContent || '';
        if (!text.trim()) return;

        const { normalized: normalizedText, indexMap } = normalizeWithMap(text);
        if (!normalizedText) return;
        let searchStart = 0;
        let matchIdx = normalizedText.indexOf(searchTerm, searchStart);

        while (matchIdx !== -1) {
          const endIdx = matchIdx + searchTerm.length;
          const originalStart = indexMap[matchIdx];
          const originalEnd = indexMap[endIdx - 1];

          if (originalStart !== undefined && originalEnd !== undefined) {
            const rect = getTextNodeRect(span, originalStart, originalEnd + 1);
            if (rect && rect.width > 0) {
              allMatches.push({
                span,
                startIdx: originalStart,
                endIdx: originalEnd + 1,
                rect,
                normalizedText: normalizeString(text.slice(originalStart, originalEnd + 1))
              });
            }
          }

          searchStart = matchIdx + 1;
          matchIdx = normalizedText.indexOf(searchTerm, searchStart);
        }
      });

      if (pageResults.length > allMatches.length) {
        logger.warn(
          'Search results exceed text layer matches',
          'PDFSearchHighlightLayer.computeHighlights',
          {
            pageNumber,
            results: pageResults.length,
            matches: allMatches.length
          }
        );
      }

      const usedMatches = new Set<number>();
      let missingMatches = 0;

      pageResults.forEach((result) => {
        const rects: HighlightRect[] = [];

        let matchIndex = -1;

        if (result.matchText) {
          const normalizedMatchText = normalizeString(result.matchText);
          if (normalizedMatchText) {
            matchIndex = allMatches.findIndex(
              (match, index) => !usedMatches.has(index) && match.normalizedText === normalizedMatchText
            );
          }
        }

        if (matchIndex === -1) {
          matchIndex = allMatches.findIndex((_, index) => !usedMatches.has(index));
        }

        if (matchIndex !== -1) {
          const matchInfo = allMatches[matchIndex];
          usedMatches.add(matchIndex);
          rects.push({
            x: (matchInfo.rect.left - parentRect.left) / scale,
            y: (matchInfo.rect.top - parentRect.top) / scale,
            width: matchInfo.rect.width / scale,
            height: matchInfo.rect.height / scale
          });
          newRects.set(result.matchIndex, rects);
        } else {
          missingMatches += 1;
        }
      });

      if (missingMatches > 0) {
        logger.warn(
          'Search results without matching text layer rects',
          'PDFSearchHighlightLayer.computeHighlights',
          { pageNumber, missingMatches }
        );
      }

      if (!rectsMapAreEqual(newRects, lastRectsRef.current)) {
        lastRectsRef.current = newRects;
        setHighlightRects(newRects);
      }
    };

    const timeoutId = setTimeout(computeHighlights, 100);
    return () => {
      clearTimeout(timeoutId);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [pageResults, pageNumber, scale, searchQuery]);

  if (pageResults.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {pageResults.map((result, idx) => {
        const rects = highlightRects.get(result.matchIndex) || [];
        const isCurrent = currentResultOnPage &&
          currentResultOnPage.matchStart === result.matchStart &&
          currentResultOnPage.matchIndex === result.matchIndex;

        return (
          <div key={`search-${result.matchIndex}-${idx}`}>
            {rects.map((rect, rectIdx) => (
              <div
                key={rectIdx}
                ref={isCurrent ? currentResultRef : null}
                className={`absolute transition-all duration-200 ${
                  isCurrent
                    ? 'bg-orange-400/60 ring-2 ring-orange-500 animate-pulse'
                    : 'bg-yellow-300/50'
                }`}
                style={{
                  left: `${rect.x * scale}px`,
                  top: `${rect.y * scale}px`,
                  width: `${rect.width * scale}px`,
                  height: `${rect.height * scale}px`,
                  borderRadius: '2px'
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.pageNumber === nextProps.pageNumber &&
    prevProps.scale === nextProps.scale &&
    prevProps.searchResults === nextProps.searchResults &&
    prevProps.currentSearchIndex === nextProps.currentSearchIndex &&
    prevProps.searchQuery === nextProps.searchQuery
  );
});

PDFSearchHighlightLayer.displayName = 'PDFSearchHighlightLayer';

export default PDFSearchHighlightLayer;
