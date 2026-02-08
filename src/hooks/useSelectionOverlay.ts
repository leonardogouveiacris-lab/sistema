import { useState, useEffect, useCallback, useRef } from 'react';
import { mergeRectsIntoLines } from '../utils/rectMerger';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
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

interface CaretInfo {
  node: Node | null;
  offset: number;
  spanIndex: number;
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

function getCaretInfoFromPoint(x: number, y: number, textLayer: Element): CaretInfo | null {
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

  const container = caretRange.startContainer;
  const offset = caretRange.startOffset;

  const parentElement = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : container as Element;

  if (!parentElement || !textLayer.contains(parentElement)) return null;

  const spans = Array.from(textLayer.querySelectorAll('span[role="presentation"], span:not([role])'));
  const spanIndex = spans.findIndex((s) => s.contains(container));

  return {
    node: container,
    offset,
    spanIndex
  };
}

function findNearestTextSpan(x: number, y: number, textLayer: Element, metrics: TextMetrics): HTMLElement | null {
  const spans = textLayer.querySelectorAll('span[role="presentation"], span:not([role])');
  let nearestSpan: HTMLElement | null = null;
  let minDistance = Infinity;

  const searchRadius = metrics.lineHeight * 2;

  spans.forEach((span) => {
    if (!(span instanceof HTMLElement)) return;
    if (span.textContent?.trim() === '') return;

    const rect = span.getBoundingClientRect();
    const spanCenterX = rect.left + rect.width / 2;
    const spanCenterY = rect.top + rect.height / 2;

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

/**
 * Em PDFs/textLayers, caretRangeFromPoint pode "teleportar" em whitespace grande.
 * Este helper tenta primeiro o caret direto; se falhar (ou cair fora), faz snap para o span mais próximo
 * e re-testa em um ponto garantidamente dentro do span.
 */
function getSnappedCaretInfoFromPoint(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics
): CaretInfo | null {
  const direct = getCaretInfoFromPoint(x, y, textLayer);
  if (direct && direct.spanIndex >= 0) return direct;

  const nearestSpan = findNearestTextSpan(x, y, textLayer, metrics);
  if (!nearestSpan) return direct;

  const r = nearestSpan.getBoundingClientRect();

  const insideX = Math.min(Math.max(x, r.left + 1), r.right - 1);
  const insideY = Math.min(Math.max(y, r.top + 1), r.bottom - 1);

  return getCaretInfoFromPoint(insideX, insideY, textLayer) || direct;
}

function findLineSpans(targetSpan: HTMLElement, textLayer: Element, metrics: TextMetrics): HTMLElement[] {
  const spans = textLayer.querySelectorAll('span[role="presentation"], span:not([role])');
  if (spans.length === 0) return [targetSpan];

  const targetRect = targetSpan.getBoundingClientRect();
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const tolerance = metrics.lineHeight * 0.5;

  const lineSpans: HTMLElement[] = [];

  spans.forEach((span) => {
    if (!(span instanceof HTMLElement)) return;
    if (span.textContent?.trim() === '') return;

    const spanRect = span.getBoundingClientRect();
    const spanCenterY = spanRect.top + spanRect.height / 2;

    if (Math.abs(spanCenterY - targetCenterY) <= tolerance) {
      lineSpans.push(span);
    }
  });

  lineSpans.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    return rectA.left - rectB.left;
  });

  return lineSpans.length > 0 ? lineSpans : [targetSpan];
}

function selectFullLine(targetSpan: HTMLElement): void {
  const textLayer = targetSpan.closest('.textLayer') || targetSpan.closest('.react-pdf__Page__textContent');
  if (!textLayer) return;

  const metrics = getTextMetricsFromTextLayer(textLayer);
  const lineSpans = findLineSpans(targetSpan, textLayer, metrics);
  if (lineSpans.length <= 1) return;

  const firstSpan = lineSpans[0];
  const lastSpan = lineSpans[lineSpans.length - 1];

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();

  if (firstSpan.firstChild) {
    range.setStart(firstSpan.firstChild, 0);
  } else {
    range.setStart(firstSpan, 0);
  }

  if (lastSpan.lastChild) {
    const textNode = lastSpan.lastChild;
    range.setEnd(textNode, textNode.textContent?.length || 0);
  } else {
    range.setEnd(lastSpan, lastSpan.childNodes.length);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function hasCaretIndexChanged(prev: CaretInfo | null, current: CaretInfo | null): boolean {
  if (!prev || !current) return true;
  return prev.spanIndex !== current.spanIndex || prev.offset !== current.offset;
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
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const lastValidRectsRef = useRef<Map<number, SelectionRect[]>>(new Map());
  const startCaretInfoRef = useRef<CaretInfo | null>(null);
  const lastCaretInfoRef = useRef<CaretInfo | null>(null);
  const currentTextMetricsRef = useRef<TextMetrics | null>(null);
  const selectionStartedRef = useRef(false);
  const initialClickPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearOverlay = useCallback(() => {
    lastRectsMapRef.current = new Map();
    hasActiveSelectionRef.current = false;
    lastSelectionTextRef.current = '';
    lastValidRectsRef.current = new Map();
    dragStartPosRef.current = null;
    currentMousePosRef.current = null;
    startCaretInfoRef.current = null;
    lastCaretInfoRef.current = null;
    selectionStartedRef.current = false;
    initialClickPosRef.current = null;
    setSelectionsByPage(new Map());
    setHasSelection(false);
  }, []);

  const calculateSelectionRects = useCallback(() => {
    const selection = document.getSelection();
    const selectionText = selection?.toString() || '';

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (isMouseDownRef.current) {
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
      if (isMouseDownRef.current) {
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
      const startPos = dragStartPosRef.current;
      const currentPos = currentMousePosRef.current;
      const metrics = currentTextMetricsRef.current;

      if (isMouseDownRef.current && startPos && currentPos && lastValidRectsRef.current.size > 0 && metrics) {
        const isDraggingDown = currentPos.y > startPos.y;

        let currentMinY = Infinity;
        let currentMaxY = -Infinity;
        let lastMinY = Infinity;
        let lastMaxY = -Infinity;

        pageRectsMap.forEach((rects) => {
          rects.forEach((rect) => {
            currentMinY = Math.min(currentMinY, rect.y);
            currentMaxY = Math.max(currentMaxY, rect.y + rect.height);
          });
        });

        lastValidRectsRef.current.forEach((rects) => {
          rects.forEach((rect) => {
            lastMinY = Math.min(lastMinY, rect.y);
            lastMaxY = Math.max(lastMaxY, rect.y + rect.height);
          });
        });

        const verticalJumpThreshold = metrics.lineHeight * 0.8;
        const largeJumpThreshold = metrics.lineHeight * 3;

        const jumpedUp = isDraggingDown && currentMinY < lastMinY - verticalJumpThreshold;
        const jumpedDown = !isDraggingDown && currentMaxY > lastMaxY + verticalJumpThreshold;
        const largeJump = Math.abs(currentMinY - lastMinY) > largeJumpThreshold ||
                          Math.abs(currentMaxY - lastMaxY) > largeJumpThreshold;

        if (jumpedUp || jumpedDown || (largeJump && (jumpedUp || jumpedDown))) {
          return;
        }
      }

      lastRectsMapRef.current = pageRectsMap;
      lastValidRectsRef.current = new Map(pageRectsMap);
      hasActiveSelectionRef.current = true;
      lastSelectionTextRef.current = selectionText;
      setSelectionsByPage(new Map(pageRectsMap));
      setHasSelection(true);
    }
  }, [containerRef, clearOverlay]);

  const handleSelectionChange = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    calculateSelectionRects();

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
    clearOverlay();
  }, [clearOverlay]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      currentMousePosRef.current = { x: e.clientX, y: e.clientY };
      initialClickPosRef.current = { x: e.clientX, y: e.clientY };
      lastValidRectsRef.current = new Map();
      selectionStartedRef.current = false;

      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (textLayer) {
        currentTextMetricsRef.current = getTextMetricsFromTextLayer(textLayer);
        startCaretInfoRef.current = getCaretInfoFromPoint(e.clientX, e.clientY, textLayer);
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
      if (!isMouseDownRef.current) return;

      currentMousePosRef.current = { x: e.clientX, y: e.clientY };

      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (!textLayer || !currentTextMetricsRef.current) return;

      const metrics = currentTextMetricsRef.current;
      const initialPos = initialClickPosRef.current;

      if (!selectionStartedRef.current && initialPos) {
        const dx = Math.abs(e.clientX - initialPos.x);
        const dy = Math.abs(e.clientY - initialPos.y);

        // ajuste leve pra evitar "hipersensibilidade" em PDF
        const minDragForChar = Math.max(metrics.averageCharWidth * 0.5, metrics.fontSize * 0.25);
        const minDragForLine = metrics.lineHeight * 0.3;

        const currentCaret = getSnappedCaretInfoFromPoint(e.clientX, e.clientY, textLayer, metrics);
        const caretChanged = hasCaretIndexChanged(startCaretInfoRef.current, currentCaret);

        if (caretChanged || dx >= minDragForChar || dy >= minDragForLine) {
          selectionStartedRef.current = true;
          lastCaretInfoRef.current = currentCaret;
        }
      } else if (selectionStartedRef.current) {
        const currentCaret = getSnappedCaretInfoFromPoint(e.clientX, e.clientY, textLayer, metrics);
        lastCaretInfoRef.current = currentCaret;
      }
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
      dragStartPosRef.current = null;
      currentMousePosRef.current = null;
      initialClickPosRef.current = null;
      selectionStartedRef.current = false;

      requestAnimationFrame(() => {
        calculateSelectionRects();
      });
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (!textLayer) return;

      const metrics = getTextMetricsFromTextLayer(textLayer);
      currentTextMetricsRef.current = metrics;

      let clickedSpan = target.closest('span[role="presentation"]') ||
                        target.closest('.textLayer > span') ||
                        target.closest('.react-pdf__Page__textContent > span');

      if (!(clickedSpan instanceof HTMLElement)) {
        clickedSpan = findNearestTextSpan(e.clientX, e.clientY, textLayer, metrics);
      }

      if (!(clickedSpan instanceof HTMLElement)) return;

      setTimeout(() => {
        selectFullLine(clickedSpan as HTMLElement);
        requestAnimationFrame(() => {
          calculateSelectionRects();
        });
      }, 10);
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
          calculateSelectionRects();
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
  }, [containerRef, clearSelection, calculateSelectionRects]);

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