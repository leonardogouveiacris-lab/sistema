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
  isDragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
}

interface SpanInfo {
  span: HTMLElement;
  rect: DOMRect;
  textNode: Node | null;
}

interface RangeSignature {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}

function areRangesEqual(a: RangeSignature | null, b: RangeSignature | null): boolean {
  if (!a || !b) return false;
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

function getRangeSignature(range: Range): RangeSignature {
  return {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset
  };
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
  anchorY: number,
  lastValidSpan?: SpanInfo | null
): SpanInfo | null {
  if (spans.length === 0) return null;

  const isDraggingDown = y > anchorY;

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
  let targetLineIndex = -1;

  for (let i = 0; i < sortedLines.length; i++) {
    const [, lineSpans] = sortedLines[i];
    const lineTop = Math.min(...lineSpans.map(s => s.rect.top));
    const lineBottom = Math.max(...lineSpans.map(s => s.rect.bottom));

    if (y >= lineTop && y <= lineBottom) {
      targetLine = lineSpans;
      targetLineIndex = i;
      break;
    }
  }

  if (!targetLine && sortedLines.length > 0) {
    for (let i = 0; i < sortedLines.length; i++) {
      const [, lineSpans] = sortedLines[i];
      const lineTop = Math.min(...lineSpans.map(s => s.rect.top));
      const lineBottom = Math.max(...lineSpans.map(s => s.rect.bottom));

      if (y < lineTop) {
        if (isDraggingDown && i > 0) {
          targetLine = sortedLines[i - 1][1];
          targetLineIndex = i - 1;
        } else {
          targetLine = lineSpans;
          targetLineIndex = i;
        }
        break;
      }

      if (i === sortedLines.length - 1 && y > lineBottom) {
        targetLine = lineSpans;
        targetLineIndex = i;
      }
    }
  }

  if (!targetLine) return lastValidSpan || null;

  targetLine.sort((a, b) => a.rect.left - b.rect.left);

  for (const info of targetLine) {
    if (x >= info.rect.left && x <= info.rect.right) {
      return info;
    }
  }

  if (lastValidSpan) {
    const lastSpanInTargetLine = targetLine.find(s => s.span === lastValidSpan.span);
    if (lastSpanInTargetLine) {
      const lastSpanIndex = targetLine.indexOf(lastSpanInTargetLine);

      for (let i = 0; i < targetLine.length; i++) {
        const span = targetLine[i];
        const nextSpan = targetLine[i + 1];

        if (nextSpan && x > span.rect.right && x < nextSpan.rect.left) {
          if (lastSpanIndex <= i) {
            return span;
          } else {
            return nextSpan;
          }
        }
      }
    }
  }

  let closestSpan = targetLine[0];
  let minDist = Infinity;

  for (const info of targetLine) {
    const distLeft = Math.abs(x - info.rect.left);
    const distRight = Math.abs(x - info.rect.right);
    const dist = Math.min(distLeft, distRight);
    if (dist < minDist) {
      minDist = dist;
      closestSpan = info;
    }
  }

  if (x < targetLine[0].rect.left) {
    return targetLine[0];
  }

  if (x > targetLine[targetLine.length - 1].rect.right) {
    return targetLine[targetLine.length - 1];
  }

  return closestSpan;
}

function getSnappedCaretInfo(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics,
  anchorY: number,
  lastValidSpan?: SpanInfo | null
): { node: Node; offset: number; spanInfo?: SpanInfo } | null {
  const direct = getCaretInfoFromPoint(x, y);
  if (direct && textLayer.contains(direct.node)) {
    const parentSpan = (direct.node.parentElement?.closest('span[role="presentation"], span:not([role])') ||
      direct.node.parentElement) as HTMLElement | null;
    if (parentSpan) {
      const rect = parentSpan.getBoundingClientRect();
      const textNode = parentSpan.firstChild?.nodeType === Node.TEXT_NODE ? parentSpan.firstChild : null;
      return {
        node: direct.node,
        offset: direct.offset,
        spanInfo: { span: parentSpan, rect, textNode }
      };
    }
    return direct;
  }

  const spans = getSpansWithInfo(textLayer);
  const bestSpan = findBestSpanForPoint(x, y, spans, metrics, anchorY, lastValidSpan);

  if (!bestSpan) {
    if (lastValidSpan && textLayer.contains(lastValidSpan.span)) {
      const r = lastValidSpan.rect;
      const clampedX = x < r.left ? r.left + 1 : r.right - 1;
      const clampedY = r.top + r.height / 2;
      const snapped = getCaretInfoFromPoint(clampedX, clampedY);
      if (snapped && textLayer.contains(snapped.node)) {
        return { ...snapped, spanInfo: lastValidSpan };
      }
    }
    return direct ? { ...direct } : null;
  }

  const r = bestSpan.rect;
  const clampedX = Math.min(Math.max(x, r.left + 1), r.right - 1);
  const clampedY = r.top + r.height / 2;

  const snapped = getCaretInfoFromPoint(clampedX, clampedY);
  if (snapped && textLayer.contains(snapped.node)) {
    return { ...snapped, spanInfo: bestSpan };
  }

  if (bestSpan.textNode) {
    const text = bestSpan.textNode.textContent || '';
    const charWidth = text.length > 0 ? r.width / text.length : metrics.averageCharWidth;
    let offset = Math.round((x - r.left) / charWidth);
    offset = Math.max(0, Math.min(offset, text.length));

    return { node: bestSpan.textNode, offset, spanInfo: bestSpan };
  }

  return direct ? { ...direct } : null;
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

function selectWordAtPoint(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics,
  isProgrammaticRef?: React.MutableRefObject<boolean>,
  lastAppliedRangeRef?: React.MutableRefObject<RangeSignature | null>
): boolean {
  const caretInfo = getSnappedCaretInfo(x, y, textLayer, metrics, y, null);
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

  const newSignature = getRangeSignature(range);
  if (lastAppliedRangeRef && areRangesEqual(lastAppliedRangeRef.current, newSignature)) {
    return true;
  }

  if (isProgrammaticRef) {
    isProgrammaticRef.current = true;
  }
  try {
    selection.removeAllRanges();
    selection.addRange(range);
    if (lastAppliedRangeRef) {
      lastAppliedRangeRef.current = newSignature;
    }
  } finally {
    if (isProgrammaticRef) {
      queueMicrotask(() => {
        isProgrammaticRef.current = false;
      });
    }
  }

  return true;
}

export function useSelectionOverlay(
  containerRef: React.RefObject<HTMLElement | null>
): SelectionOverlayResult {
  const [selectionsByPage, setSelectionsByPage] = useState<Map<number, SelectionRect[]>>(
    new Map()
  );
  const [hasSelection, setHasSelection] = useState(false);
  const pendingRafRef = useRef<number | null>(null);
  const lastRectsMapRef = useRef<Map<number, SelectionRect[]>>(new Map());
  const isMouseDownRef = useRef(false);
  const hasActiveSelectionRef = useRef(false);
  const lastSelectionTextRef = useRef('');
  const isKeyboardSelectingRef = useRef(false);
  const currentTextMetricsRef = useRef<TextMetrics | null>(null);
  const isProgrammaticSelectionRef = useRef(false);
  const lastAppliedRangeRef = useRef<RangeSignature | null>(null);
  const selectionUpdateTokenRef = useRef(0);
  const dragStateRef = useRef<DragState>({
    isDragging: false,
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
      if (isMouseDownRef.current && dragStateRef.current.isDragging && lastRectsMapRef.current.size > 0) {
        return;
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
    if (isProgrammaticSelectionRef.current) {
      return;
    }

    selectionUpdateTokenRef.current++;
    const currentToken = selectionUpdateTokenRef.current;

    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current);
    }

    pendingRafRef.current = requestAnimationFrame(() => {
      if (selectionUpdateTokenRef.current !== currentToken) {
        return;
      }
      calculateSelectionRects(isMouseDownRef.current);
      pendingRafRef.current = null;
    });
  }, [calculateSelectionRects]);

  const clearSelection = useCallback(() => {
    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current);
      pendingRafRef.current = null;
    }
    selectionUpdateTokenRef.current++;
    lastAppliedRangeRef.current = null;

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    dragStateRef.current = {
      isDragging: false,
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
        dragStateRef.current = {
          isDragging: true,
          lastMouseX: e.clientX,
          lastMouseY: e.clientY
        };
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

      dragStateRef.current.lastMouseX = e.clientX;
      dragStateRef.current.lastMouseY = e.clientY;
    };

    const handleMouseUp = () => {
      const wasDragging = dragStateRef.current.isDragging;
      isMouseDownRef.current = false;
      dragStateRef.current.isDragging = false;

      if (wasDragging) {
        selectionUpdateTokenRef.current++;
        const currentToken = selectionUpdateTokenRef.current;

        if (pendingRafRef.current !== null) {
          cancelAnimationFrame(pendingRafRef.current);
        }
        pendingRafRef.current = requestAnimationFrame(() => {
          if (selectionUpdateTokenRef.current !== currentToken) {
            return;
          }
          calculateSelectionRects(true);
          pendingRafRef.current = null;
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

      const selected = selectWordAtPoint(
        e.clientX,
        e.clientY,
        textLayer,
        metrics,
        isProgrammaticSelectionRef,
        lastAppliedRangeRef
      );

      if (selected) {
        selectionUpdateTokenRef.current++;
        const currentToken = selectionUpdateTokenRef.current;

        if (pendingRafRef.current !== null) {
          cancelAnimationFrame(pendingRafRef.current);
        }
        pendingRafRef.current = requestAnimationFrame(() => {
          if (selectionUpdateTokenRef.current !== currentToken) {
            return;
          }
          calculateSelectionRects(true);
          pendingRafRef.current = null;
        });
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

        selectionUpdateTokenRef.current++;
        const currentToken = selectionUpdateTokenRef.current;

        if (pendingRafRef.current !== null) {
          cancelAnimationFrame(pendingRafRef.current);
        }
        pendingRafRef.current = requestAnimationFrame(() => {
          if (selectionUpdateTokenRef.current !== currentToken) {
            return;
          }
          calculateSelectionRects(true);
          pendingRafRef.current = null;
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
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    };
  }, [handleSelectionChange]);

  return {
    selectionsByPage,
    hasSelection,
    clearSelection
  };
}
