import { useState, useEffect, useCallback, useRef } from 'react';
import { mergeRectsIntoLines } from '../utils/rectMerger';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function areRectsEqual(a: SelectionRect[], b: SelectionRect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      Math.abs(a[i].x - b[i].x) > 0.5 ||
      Math.abs(a[i].y - b[i].y) > 0.5 ||
      Math.abs(a[i].width - b[i].width) > 0.5 ||
      Math.abs(a[i].height - b[i].height) > 0.5
    ) {
      return false;
    }
  }
  return true;
}

function areMapsEqual(
  a: Map<number, SelectionRect[]>,
  b: Map<number, SelectionRect[]>
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, aRects] of a) {
    const bRects = b.get(key);
    if (!bRects || !areRectsEqual(aRects, bRects)) {
      return false;
    }
  }
  return true;
}

export interface SelectionOverlayResult {
  selectionsByPage: Map<number, SelectionRect[]>;
  hasSelection: boolean;
  clearSelection: () => void;
}

interface TextMetrics {
  lineHeight: number;
  fontSize: number;
  averageCharWidth: number;
}

interface DragState {
  anchorX: number;
  anchorY: number;
  anchorNode: Node | null;
  anchorOffset: number;
  anchorTextLayer: Element | null;
  isDragging: boolean;
}

function getTextMetricsFromTextLayer(textLayer: Element): TextMetrics {
  const spans = textLayer.querySelectorAll('span[role="presentation"], span:not([role])');
  let totalHeight = 0;
  let totalFontSize = 0;
  let totalCharWidth = 0;
  let validSpans = 0;
  let charCount = 0;

  spans.forEach((span) => {
    if (!(span instanceof HTMLElement)) return;
    const text = span.textContent || '';
    if (text.trim() === '') return;

    const rect = span.getBoundingClientRect();
    if (rect.height <= 0) return;

    const computedStyle = window.getComputedStyle(span);
    const fontSize = parseFloat(computedStyle.fontSize) || 12;

    totalHeight += rect.height;
    totalFontSize += fontSize;
    validSpans++;

    if (text.length > 0 && rect.width > 0) {
      totalCharWidth += rect.width / text.length;
      charCount++;
    }
  });

  const avgHeight = validSpans > 0 ? totalHeight / validSpans : 16;
  const avgFontSize = validSpans > 0 ? totalFontSize / validSpans : 12;
  const avgCharWidth = charCount > 0 ? totalCharWidth / charCount : 8;

  return {
    lineHeight: avgHeight,
    fontSize: avgFontSize,
    averageCharWidth: avgCharWidth
  };
}

function getCaretInfoFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  let caretRange: Range | null = null;

  if (document.caretRangeFromPoint) {
    caretRange = document.caretRangeFromPoint(x, y);
  } else if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y);
    if (pos) {
      caretRange = document.createRange();
      caretRange.setStart(pos.offsetNode, pos.offset);
      caretRange.setEnd(pos.offsetNode, pos.offset);
    }
  }

  if (!caretRange) return null;

  return {
    node: caretRange.startContainer,
    offset: caretRange.startOffset
  };
}

function findNearestTextSpan(x: number, y: number, textLayer: Element, metrics: TextMetrics): HTMLElement | null {
  const spans = textLayer.querySelectorAll('span[role="presentation"], span:not([role])');
  let nearestSpan: HTMLElement | null = null;
  let minDistance = Infinity;

  const searchRadius = metrics.lineHeight * 3;

  spans.forEach((span) => {
    if (!(span instanceof HTMLElement)) return;
    if (span.textContent?.trim() === '') return;

    const rect = span.getBoundingClientRect();

    let distance: number;

    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      distance = 0;
    } else {
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const verticalWeight = 1.5;
      distance = Math.sqrt(dx * dx + (dy * verticalWeight) * (dy * verticalWeight));
    }

    if (distance < minDistance && distance <= searchRadius) {
      minDistance = distance;
      nearestSpan = span;
    }
  });

  return nearestSpan;
}

function getSnappedCaretInfo(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics
): { node: Node; offset: number } | null {
  const direct = getCaretInfoFromPoint(x, y);
  if (direct && textLayer.contains(direct.node)) return direct;

  const nearestSpan = findNearestTextSpan(x, y, textLayer, metrics);
  if (!nearestSpan) return direct;

  const r = nearestSpan.getBoundingClientRect();
  const insideX = Math.min(Math.max(x, r.left + 1), r.right - 1);
  const insideY = Math.min(Math.max(y, r.top + 1), r.bottom - 1);

  const snapped = getCaretInfoFromPoint(insideX, insideY);
  return snapped && textLayer.contains(snapped.node) ? snapped : direct;
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

function selectWordAtPoint(x: number, y: number, textLayer: Element, metrics: TextMetrics): boolean {
  const caretInfo = getSnappedCaretInfo(x, y, textLayer, metrics);
  if (!caretInfo || !caretInfo.node) return false;

  const textNode = caretInfo.node.nodeType === Node.TEXT_NODE
    ? caretInfo.node
    : caretInfo.node.firstChild;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return false;

  const text = textNode.textContent || '';
  let offset = Math.min(caretInfo.offset, text.length);

  if (offset > 0 && offset === text.length) {
    offset--;
  }

  if (text.length === 0 || !isWordChar(text[offset])) {
    if (offset > 0 && isWordChar(text[offset - 1])) {
      offset--;
    } else {
      return false;
    }
  }

  let startOffset = offset;
  let endOffset = offset;

  while (startOffset > 0 && isWordChar(text[startOffset - 1])) {
    startOffset--;
  }

  while (endOffset < text.length && isWordChar(text[endOffset])) {
    endOffset++;
  }

  const spans = Array.from(textLayer.querySelectorAll('span[role="presentation"], span:not([role])'));
  const currentSpanIndex = spans.findIndex(s => s.contains(textNode));

  if (currentSpanIndex < 0) return false;

  const currentSpan = spans[currentSpanIndex] as HTMLElement;
  const currentRect = currentSpan.getBoundingClientRect();
  const tolerance = metrics.lineHeight * 0.5;

  let finalStartNode: Node = textNode;
  let finalStartOffset = startOffset;
  let finalEndNode: Node = textNode;
  let finalEndOffset = endOffset;

  if (startOffset === 0) {
    let referenceRect = currentRect;

    for (let i = currentSpanIndex - 1; i >= 0; i--) {
      const prevSpan = spans[i] as HTMLElement;
      const prevRect = prevSpan.getBoundingClientRect();

      if (Math.abs(prevRect.top - currentRect.top) > tolerance) break;

      const prevText = prevSpan.textContent || '';
      if (prevText.length === 0) continue;

      const gapBetweenSpans = referenceRect.left - prevRect.right;
      if (gapBetweenSpans > metrics.averageCharWidth * 1.5) break;

      const lastChar = prevText[prevText.length - 1];
      if (!isWordChar(lastChar)) break;

      const prevTextNode = prevSpan.firstChild;
      if (!prevTextNode || prevTextNode.nodeType !== Node.TEXT_NODE) break;

      let prevStartOffset = prevText.length - 1;
      while (prevStartOffset > 0 && isWordChar(prevText[prevStartOffset - 1])) {
        prevStartOffset--;
      }

      finalStartNode = prevTextNode;
      finalStartOffset = prevStartOffset;
      referenceRect = prevRect;

      if (prevStartOffset > 0) break;
    }
  }

  if (endOffset === text.length) {
    let lastSpanRect = currentRect;

    for (let i = currentSpanIndex + 1; i < spans.length; i++) {
      const nextSpan = spans[i] as HTMLElement;
      const nextRect = nextSpan.getBoundingClientRect();

      if (Math.abs(nextRect.top - currentRect.top) > tolerance) break;

      const nextText = nextSpan.textContent || '';
      if (nextText.length === 0) continue;

      const gapBetweenSpans = nextRect.left - lastSpanRect.right;
      if (gapBetweenSpans > metrics.averageCharWidth * 1.5) break;

      const firstChar = nextText[0];
      if (!isWordChar(firstChar)) break;

      const nextTextNode = nextSpan.firstChild;
      if (!nextTextNode || nextTextNode.nodeType !== Node.TEXT_NODE) break;

      let nextEndOffset = 1;
      while (nextEndOffset < nextText.length && isWordChar(nextText[nextEndOffset])) {
        nextEndOffset++;
      }

      finalEndNode = nextTextNode;
      finalEndOffset = nextEndOffset;
      lastSpanRect = nextRect;

      if (nextEndOffset < nextText.length) break;
    }
  }

  const selection = window.getSelection();
  if (!selection) return false;

  const range = document.createRange();
  range.setStart(finalStartNode, finalStartOffset);
  range.setEnd(finalEndNode, finalEndOffset);

  selection.removeAllRanges();
  selection.addRange(range);

  return true;
}

function createSelectionFromPoints(
  anchorNode: Node,
  anchorOffset: number,
  focusNode: Node,
  focusOffset: number
): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();

  const tempRange = document.createRange();
  tempRange.setStart(anchorNode, anchorOffset);
  tempRange.setEnd(focusNode, focusOffset);

  const isForward = !tempRange.collapsed && tempRange.startContainer === anchorNode && tempRange.startOffset === anchorOffset;

  if (isForward || tempRange.collapsed) {
    range.setStart(anchorNode, anchorOffset);
    range.setEnd(focusNode, focusOffset);
  } else {
    range.setStart(focusNode, focusOffset);
    range.setEnd(anchorNode, anchorOffset);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export function useSelectionOverlay(
  containerRef: React.RefObject<HTMLElement | null>
): SelectionOverlayResult {
  const [selectionsByPage, setSelectionsByPage] = useState<Map<number, SelectionRect[]>>(
    new Map()
  );
  const [hasSelection, setHasSelection] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRectsMapRef = useRef<Map<number, SelectionRect[]>>(new Map());
  const isMouseDownRef = useRef(false);
  const hasActiveSelectionRef = useRef(false);
  const lastSelectionTextRef = useRef('');
  const isKeyboardSelectingRef = useRef(false);
  const currentTextMetricsRef = useRef<TextMetrics | null>(null);
  const dragStateRef = useRef<DragState>({
    anchorX: 0,
    anchorY: 0,
    anchorNode: null,
    anchorOffset: 0,
    anchorTextLayer: null,
    isDragging: false
  });
  const lastValidRectsRef = useRef<Map<number, SelectionRect[]>>(new Map());
  const updatePendingRef = useRef(false);

  const clearOverlay = useCallback(() => {
    if (lastRectsMapRef.current.size === 0 && !hasActiveSelectionRef.current) {
      return;
    }
    lastRectsMapRef.current = new Map();
    lastValidRectsRef.current = new Map();
    hasActiveSelectionRef.current = false;
    lastSelectionTextRef.current = '';
    setSelectionsByPage(new Map());
    setHasSelection(false);
  }, []);

  const calculateSelectionRects = useCallback((forceUpdate = false) => {
    if (updatePendingRef.current && !forceUpdate) {
      return;
    }

    const selection = document.getSelection();
    const selectionText = selection?.toString() || '';

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (isMouseDownRef.current && dragStateRef.current.isDragging) {
        return;
      }
      if (hasActiveSelectionRef.current && lastRectsMapRef.current.size > 0) {
        return;
      }
      if (lastRectsMapRef.current.size > 0) {
        clearOverlay();
      }
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();

    if (clientRects.length === 0) {
      if (isMouseDownRef.current && lastValidRectsRef.current.size > 0) {
        return;
      }
      if (hasActiveSelectionRef.current && lastRectsMapRef.current.size > 0) {
        return;
      }
      return;
    }

    const pageRectsMap = new Map<number, SelectionRect[]>();

    const findPageForNode = (node: Node | null): { pageNumber: number; pageEl: Element } | null => {
      if (!node) return null;
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element;
      if (!element) return null;
      const pageEl = element.closest('[data-global-page]');
      if (!pageEl) return null;
      const pageNumber = parseInt(pageEl.getAttribute('data-global-page') || '0', 10);
      if (pageNumber === 0) return null;
      return { pageNumber, pageEl };
    };

    const anchorPage = findPageForNode(range.startContainer);
    const focusPage = findPageForNode(range.endContainer);

    if (!anchorPage && !focusPage) {
      return;
    }

    const pagesToCheck = new Set<number>();
    if (anchorPage) pagesToCheck.add(anchorPage.pageNumber);
    if (focusPage) pagesToCheck.add(focusPage.pageNumber);

    const minPage = Math.min(...Array.from(pagesToCheck));
    const maxPage = Math.max(...Array.from(pagesToCheck));
    for (let p = minPage; p <= maxPage; p++) {
      pagesToCheck.add(p);
    }

    pagesToCheck.forEach((pageNumber) => {
      const pageEl = container.querySelector(`[data-global-page="${pageNumber}"]`);
      if (!pageEl) return;

      const textLayer = pageEl.querySelector('.textLayer') ||
                        pageEl.querySelector('.react-pdf__Page__textContent');

      const referenceEl = textLayer || pageEl;
      const referenceRect = referenceEl.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();

      const offsetX = referenceRect.left - pageRect.left;
      const offsetY = referenceRect.top - pageRect.top;

      const rectsForPage: SelectionRect[] = [];

      for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i];

        if (rect.width <= 0 || rect.height <= 0) continue;

        const hasOverlap =
          rect.right > referenceRect.left &&
          rect.left < referenceRect.right &&
          rect.bottom > referenceRect.top &&
          rect.top < referenceRect.bottom;

        if (hasOverlap) {
          rectsForPage.push({
            x: (rect.left - referenceRect.left) + offsetX,
            y: (rect.top - referenceRect.top) + offsetY,
            width: rect.width,
            height: rect.height
          });
        }
      }

      if (rectsForPage.length > 0) {
        const mergedRects = mergeRectsIntoLines(rectsForPage, 3);
        pageRectsMap.set(pageNumber, mergedRects);
      }
    });

    if (pageRectsMap.size > 0) {
      const hasChanged = !areMapsEqual(lastRectsMapRef.current, pageRectsMap);

      if (hasChanged || forceUpdate) {
        lastRectsMapRef.current = pageRectsMap;
        lastValidRectsRef.current = pageRectsMap;
        hasActiveSelectionRef.current = true;
        lastSelectionTextRef.current = selectionText;
        setSelectionsByPage(new Map(pageRectsMap));
        setHasSelection(true);
      }
    }
  }, [containerRef, clearOverlay]);

  const handleSelectionChange = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      calculateSelectionRects();
      rafRef.current = null;
    });
  }, [calculateSelectionRects]);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    dragStateRef.current = {
      anchorX: 0,
      anchorY: 0,
      anchorNode: null,
      anchorOffset: 0,
      anchorTextLayer: null,
      isDragging: false
    };
    clearOverlay();
  }, [clearOverlay]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      isMouseDownRef.current = true;

      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (textLayer) {
        currentTextMetricsRef.current = getTextMetricsFromTextLayer(textLayer);

        const caretInfo = getSnappedCaretInfo(
          e.clientX,
          e.clientY,
          textLayer,
          currentTextMetricsRef.current
        );

        if (caretInfo) {
          dragStateRef.current = {
            anchorX: e.clientX,
            anchorY: e.clientY,
            anchorNode: caretInfo.node,
            anchorOffset: caretInfo.offset,
            anchorTextLayer: textLayer,
            isDragging: true
          };
        }
      }

      if (hasActiveSelectionRef.current) {
        const isOnSelectionOverlay = target.closest('[data-selection-overlay]');
        const isOnTextSelectionPopup = target.closest('[data-text-selection-popup]');
        const isOnInlineForm = target.closest('[data-inline-form]');

        if (!isOnSelectionOverlay && !isOnTextSelectionPopup && !isOnInlineForm) {
          clearSelection();
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current || !dragStateRef.current.isDragging) return;
      if (!dragStateRef.current.anchorNode || !dragStateRef.current.anchorTextLayer) return;

      const container = containerRef.current;
      if (!container) return;

      const textLayers = container.querySelectorAll('.textLayer, .react-pdf__Page__textContent');
      let targetTextLayer: Element | null = null;

      for (const tl of textLayers) {
        const rect = tl.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          targetTextLayer = tl;
          break;
        }
      }

      if (!targetTextLayer) {
        let minDist = Infinity;
        for (const tl of textLayers) {
          const rect = tl.getBoundingClientRect();
          const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
          const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            targetTextLayer = tl;
          }
        }
      }

      if (!targetTextLayer) return;

      const metrics = currentTextMetricsRef.current || getTextMetricsFromTextLayer(targetTextLayer);
      const caretInfo = getSnappedCaretInfo(e.clientX, e.clientY, targetTextLayer, metrics);

      if (caretInfo && caretInfo.node) {
        createSelectionFromPoints(
          dragStateRef.current.anchorNode,
          dragStateRef.current.anchorOffset,
          caretInfo.node,
          caretInfo.offset
        );

        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          calculateSelectionRects(true);
          rafRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      const wasDragging = dragStateRef.current.isDragging;
      isMouseDownRef.current = false;
      dragStateRef.current.isDragging = false;

      if (wasDragging) {
        requestAnimationFrame(() => {
          calculateSelectionRects(true);
        });
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (!textLayer) return;

      e.preventDefault();

      const metrics = getTextMetricsFromTextLayer(textLayer);
      currentTextMetricsRef.current = metrics;

      const selected = selectWordAtPoint(e.clientX, e.clientY, textLayer, metrics);

      if (selected) {
        setTimeout(() => {
          requestAnimationFrame(() => {
            calculateSelectionRects(true);
          });
        }, 10);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        isKeyboardSelectingRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isKeyboardSelectingRef.current) {
        isKeyboardSelectingRef.current = false;
        requestAnimationFrame(() => {
          calculateSelectionRects(true);
        });
      }

      if (e.key === 'Escape' && hasActiveSelectionRef.current) {
        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('dblclick', handleDoubleClick);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dblclick', handleDoubleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [clearSelection, calculateSelectionRects, containerRef]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleSelectionChange]);

  return {
    selectionsByPage,
    hasSelection,
    clearSelection
  };
}
