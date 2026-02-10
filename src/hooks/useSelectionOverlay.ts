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
  lastValidNode: Node | null;
  lastValidOffset: number;
  lastMouseX: number;
  lastMouseY: number;
}

interface SpanInfo {
  span: HTMLElement;
  rect: DOMRect;
  textNode: Node | null;
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

function getSpansWithInfo(textLayer: Element): SpanInfo[] {
  const spans = textLayer.querySelectorAll('span[role="presentation"], span:not([role])');
  const result: SpanInfo[] = [];

  spans.forEach((span) => {
    if (!(span instanceof HTMLElement)) return;
    if (span.textContent?.trim() === '') return;

    const rect = span.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) return;

    const textNode = span.firstChild?.nodeType === Node.TEXT_NODE ? span.firstChild : null;
    result.push({ span, rect, textNode });
  });

  return result;
}

function findBestSpanForPoint(
  x: number,
  y: number,
  spans: SpanInfo[],
  metrics: TextMetrics,
  anchorY: number
): SpanInfo | null {
  if (spans.length === 0) return null;

  const isDraggingDown = y > anchorY;
  const isDraggingUp = y < anchorY;

  for (const info of spans) {
    if (x >= info.rect.left && x <= info.rect.right &&
        y >= info.rect.top && y <= info.rect.bottom) {
      return info;
    }
  }

  const lineGroups = new Map<number, SpanInfo[]>();
  const tolerance = metrics.lineHeight * 0.4;

  for (const info of spans) {
    const centerY = info.rect.top + info.rect.height / 2;
    let foundGroup = false;

    for (const [groupY, group] of lineGroups) {
      if (Math.abs(centerY - groupY) < tolerance) {
        group.push(info);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      lineGroups.set(centerY, [info]);
    }
  }

  const sortedLines = Array.from(lineGroups.entries()).sort((a, b) => a[0] - b[0]);

  let targetLine: SpanInfo[] | null = null;
  let minVerticalDist = Infinity;

  for (const [lineY, lineSpans] of sortedLines) {
    const firstSpan = lineSpans[0];
    const lineTop = Math.min(...lineSpans.map(s => s.rect.top));
    const lineBottom = Math.max(...lineSpans.map(s => s.rect.bottom));

    if (y >= lineTop && y <= lineBottom) {
      targetLine = lineSpans;
      break;
    }

    let dist: number;
    if (y < lineTop) {
      dist = lineTop - y;
      if (isDraggingUp && dist < minVerticalDist) {
        minVerticalDist = dist;
        targetLine = lineSpans;
      } else if (!isDraggingUp && !isDraggingDown && dist < minVerticalDist) {
        minVerticalDist = dist;
        targetLine = lineSpans;
      }
    } else {
      dist = y - lineBottom;
      if (isDraggingDown && dist < minVerticalDist) {
        minVerticalDist = dist;
        targetLine = lineSpans;
      } else if (!isDraggingUp && !isDraggingDown && dist < minVerticalDist) {
        minVerticalDist = dist;
        targetLine = lineSpans;
      }
    }
  }

  if (!targetLine && sortedLines.length > 0) {
    for (const [lineY, lineSpans] of sortedLines) {
      const lineTop = Math.min(...lineSpans.map(s => s.rect.top));
      const lineBottom = Math.max(...lineSpans.map(s => s.rect.bottom));

      const dist = y < lineTop ? lineTop - y : y - lineBottom;
      if (dist < minVerticalDist) {
        minVerticalDist = dist;
        targetLine = lineSpans;
      }
    }
  }

  if (!targetLine) return null;

  targetLine.sort((a, b) => a.rect.left - b.rect.left);

  for (const info of targetLine) {
    if (x >= info.rect.left && x <= info.rect.right) {
      return info;
    }
  }

  if (x < targetLine[0].rect.left) {
    return isDraggingUp ? targetLine[targetLine.length - 1] : targetLine[0];
  }

  if (x > targetLine[targetLine.length - 1].rect.right) {
    return isDraggingDown ? targetLine[0] : targetLine[targetLine.length - 1];
  }

  let closestSpan = targetLine[0];
  let minDist = Infinity;

  for (const info of targetLine) {
    const dist = Math.min(Math.abs(x - info.rect.left), Math.abs(x - info.rect.right));
    if (dist < minDist) {
      minDist = dist;
      closestSpan = info;
    }
  }

  return closestSpan;
}

function getSnappedCaretInfo(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics,
  anchorY: number
): { node: Node; offset: number } | null {
  const direct = getCaretInfoFromPoint(x, y);
  if (direct && textLayer.contains(direct.node)) {
    return direct;
  }

  const spans = getSpansWithInfo(textLayer);
  const bestSpan = findBestSpanForPoint(x, y, spans, metrics, anchorY);

  if (!bestSpan) return direct;

  const r = bestSpan.rect;
  const clampedX = Math.min(Math.max(x, r.left + 1), r.right - 1);
  const clampedY = r.top + r.height / 2;

  const snapped = getCaretInfoFromPoint(clampedX, clampedY);
  if (snapped && textLayer.contains(snapped.node)) {
    return snapped;
  }

  if (bestSpan.textNode) {
    const text = bestSpan.textNode.textContent || '';
    const charWidth = text.length > 0 ? r.width / text.length : metrics.averageCharWidth;
    let offset = Math.round((x - r.left) / charWidth);
    offset = Math.max(0, Math.min(offset, text.length));

    return { node: bestSpan.textNode, offset };
  }

  return direct;
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

function selectWordAtPoint(x: number, y: number, textLayer: Element, metrics: TextMetrics): boolean {
  const caretInfo = getSnappedCaretInfo(x, y, textLayer, metrics, y);
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
): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  try {
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
    return true;
  } catch {
    return false;
  }
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
    isDragging: false,
    lastValidNode: null,
    lastValidOffset: 0,
    lastMouseX: 0,
    lastMouseY: 0
  });

  const clearOverlay = useCallback(() => {
    if (lastRectsMapRef.current.size === 0 && !hasActiveSelectionRef.current) {
      return;
    }
    lastRectsMapRef.current = new Map();
    hasActiveSelectionRef.current = false;
    lastSelectionTextRef.current = '';
    setSelectionsByPage(new Map());
    setHasSelection(false);
  }, []);

  const calculateSelectionRects = useCallback((forceUpdate = false) => {
    const selection = document.getSelection();
    const selectionText = selection?.toString() || '';

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (isMouseDownRef.current && dragStateRef.current.isDragging) {
        if (dragStateRef.current.lastValidNode && lastRectsMapRef.current.size > 0) {
          return;
        }
      }
      if (hasActiveSelectionRef.current && lastRectsMapRef.current.size > 0 && !forceUpdate) {
        return;
      }
      if (lastRectsMapRef.current.size > 0 && !isMouseDownRef.current) {
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
      if (isMouseDownRef.current && lastRectsMapRef.current.size > 0) {
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
        hasActiveSelectionRef.current = true;
        lastSelectionTextRef.current = selectionText;
        setSelectionsByPage(new Map(pageRectsMap));
        setHasSelection(true);
      }
    }
  }, [containerRef, clearOverlay]);

  const handleSelectionChange = useCallback(() => {
    if (dragStateRef.current.isDragging) {
      return;
    }

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
      isDragging: false,
      lastValidNode: null,
      lastValidOffset: 0,
      lastMouseX: 0,
      lastMouseY: 0
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
          currentTextMetricsRef.current,
          e.clientY
        );

        if (caretInfo) {
          dragStateRef.current = {
            anchorX: e.clientX,
            anchorY: e.clientY,
            anchorNode: caretInfo.node,
            anchorOffset: caretInfo.offset,
            anchorTextLayer: textLayer,
            isDragging: true,
            lastValidNode: caretInfo.node,
            lastValidOffset: caretInfo.offset,
            lastMouseX: e.clientX,
            lastMouseY: e.clientY
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

      dragStateRef.current.lastMouseX = e.clientX;
      dragStateRef.current.lastMouseY = e.clientY;

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
      const caretInfo = getSnappedCaretInfo(
        e.clientX,
        e.clientY,
        targetTextLayer,
        metrics,
        dragStateRef.current.anchorY
      );

      let focusNode: Node;
      let focusOffset: number;

      if (caretInfo && caretInfo.node) {
        focusNode = caretInfo.node;
        focusOffset = caretInfo.offset;
        dragStateRef.current.lastValidNode = focusNode;
        dragStateRef.current.lastValidOffset = focusOffset;
      } else if (dragStateRef.current.lastValidNode) {
        focusNode = dragStateRef.current.lastValidNode;
        focusOffset = dragStateRef.current.lastValidOffset;
      } else {
        return;
      }

      const success = createSelectionFromPoints(
        dragStateRef.current.anchorNode,
        dragStateRef.current.anchorOffset,
        focusNode,
        focusOffset
      );

      if (success) {
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
