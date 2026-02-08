/**
 * PDFSearchHighlightLayer - Overlay component for rendering search result highlights
 *
 * Performance optimizations:
 * - Limited retry attempts for textLayer detection (prevents infinite loops)
 * - Cached textLayer reference
 * - Equality check before setState
 * - Wrapped with React.memo
 */
import React, { useMemo, useEffect, useRef, useState, memo } from 'react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';

interface PDFSearchHighlightLayerProps {
  pageNumber: number;
  scale: number;
  documentId: string;
  localPageNumber: number;
}

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_RETRY_ATTEMPTS = 20;

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
  documentId,
  localPageNumber
}) => {
  const { state } = usePDFViewer();
  const currentResultRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightRects, setHighlightRects] = useState<Map<number, HighlightRect[]>>(new Map());
  const textLayerRef = useRef<Element | null>(null);
  const lastRectsRef = useRef<Map<number, HighlightRect[]>>(new Map());

  const pageResults = useMemo(() => {
    return state.searchResults.filter(r => r.globalPageNumber === pageNumber);
  }, [state.searchResults, pageNumber]);

  const currentResultOnPage = useMemo(() => {
    if (state.currentSearchIndex < 0) return null;
    const currentResult = state.searchResults[state.currentSearchIndex];
    if (!currentResult || currentResult.globalPageNumber !== pageNumber) return null;
    return currentResult;
  }, [state.searchResults, state.currentSearchIndex, pageNumber]);

  useEffect(() => {
    if (pageResults.length === 0 || !state.searchQuery) {
      if (lastRectsRef.current.size > 0) {
        lastRectsRef.current = new Map();
        setHighlightRects(new Map());
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
      const searchTerm = state.searchQuery.toLowerCase();

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
      }

      const allMatches: MatchInfo[] = [];

      spans.forEach((span) => {
        const text = span.textContent || '';
        if (!text.trim()) return;

        const lowerText = text.toLowerCase();
        let searchStart = 0;
        let matchIdx = lowerText.indexOf(searchTerm, searchStart);

        while (matchIdx !== -1) {
          const endIdx = matchIdx + searchTerm.length;
          const rect = getTextNodeRect(span, matchIdx, endIdx);

          if (rect && rect.width > 0) {
            allMatches.push({
              span,
              startIdx: matchIdx,
              endIdx,
              rect
            });
          }

          searchStart = matchIdx + 1;
          matchIdx = lowerText.indexOf(searchTerm, searchStart);
        }
      });

      pageResults.forEach((result, resultIdx) => {
        const rects: HighlightRect[] = [];

        if (allMatches.length > 0) {
          const matchInfo = allMatches[resultIdx % allMatches.length];

          if (matchInfo) {
            rects.push({
              x: (matchInfo.rect.left - parentRect.left) / scale,
              y: (matchInfo.rect.top - parentRect.top) / scale,
              width: matchInfo.rect.width / scale,
              height: matchInfo.rect.height / scale
            });
          }
        }

        newRects.set(result.matchIndex, rects);
      });

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
  }, [pageResults, pageNumber, scale, state.searchQuery]);

  useEffect(() => {
    if (currentResultOnPage && currentResultRef.current) {
      const timeoutId = setTimeout(() => {
        currentResultRef.current?.scrollIntoView({
          behavior: 'instant',
          block: 'center'
        });
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [currentResultOnPage]);

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
    prevProps.documentId === nextProps.documentId &&
    prevProps.localPageNumber === nextProps.localPageNumber
  );
});

PDFSearchHighlightLayer.displayName = 'PDFSearchHighlightLayer';

export default PDFSearchHighlightLayer;
