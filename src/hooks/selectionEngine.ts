import { mergeRectsIntoLines } from '../utils/rectMerger';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextMetrics {
  lineHeight: number;
  fontSize: number;
  averageCharWidth: number;
}

export interface SpanInfo {
  span: HTMLElement;
  rect: DOMRect;
  textNode: Node | null;
}

export interface RangeSignature {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}

export interface CaretInfo {
  node: Node;
  offset: number;
  spanInfo?: SpanInfo;
}

export interface SelectionTelemetry {
  eventCount: number;
  lastEventTime: number;
  droppedEvents: number;
  programmaticBlocks: number;
  hysteresisHolds: number;
}

const DEBUG_ENABLED = (() => {
  try {
    return typeof window !== 'undefined' &&
      (localStorage.getItem('SELECTION_DEBUG') === 'true' ||
       new URLSearchParams(window.location.search).get('selectionDebug') === '1');
  } catch {
    return false;
  }
})();

let telemetry: SelectionTelemetry = {
  eventCount: 0,
  lastEventTime: 0,
  droppedEvents: 0,
  programmaticBlocks: 0,
  hysteresisHolds: 0
};

export function getTelemetry(): SelectionTelemetry {
  return { ...telemetry };
}

export function resetTelemetry(): void {
  telemetry = {
    eventCount: 0,
    lastEventTime: 0,
    droppedEvents: 0,
    programmaticBlocks: 0,
    hysteresisHolds: 0
  };
}

export function logSelectionEvent(event: string, data?: Record<string, unknown>): void {
  telemetry.eventCount++;
  telemetry.lastEventTime = performance.now();

  if (DEBUG_ENABLED) {
    console.log(`[Selection] ${event}`, data ?? '');
  }
}

export function incrementDroppedEvents(): void {
  telemetry.droppedEvents++;
}

export function incrementProgrammaticBlocks(): void {
  telemetry.programmaticBlocks++;
}

export function incrementHysteresisHolds(): void {
  telemetry.hysteresisHolds++;
}

export function areRectsEqual(a: SelectionRect[], b: SelectionRect[]): boolean {
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

export function areMapsEqual(
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

export function areRangesEqual(a: RangeSignature | null, b: RangeSignature | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

export function getRangeSignature(range: Range): RangeSignature {
  return {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset
  };
}

export function getTextMetricsFromTextLayer(textLayer: Element): TextMetrics {
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

export function getCaretInfoFromPoint(x: number, y: number): CaretInfo | null {
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

export function getSpansWithInfo(textLayer: Element): SpanInfo[] {
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

export function findBestSpanForPoint(
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

  for (let i = 0; i < sortedLines.length; i++) {
    const [, lineSpans] = sortedLines[i];
    let lineTop = Infinity;
    let lineBottom = -Infinity;
    for (const s of lineSpans) {
      if (s.rect.top < lineTop) lineTop = s.rect.top;
      if (s.rect.bottom > lineBottom) lineBottom = s.rect.bottom;
    }

    if (y >= lineTop && y <= lineBottom) {
      targetLine = lineSpans;
      break;
    }
  }

  if (!targetLine && sortedLines.length > 0) {
    for (let i = 0; i < sortedLines.length; i++) {
      const [, lineSpans] = sortedLines[i];
      let lineTop = Infinity;
      let lineBottom = -Infinity;
      for (const s of lineSpans) {
        if (s.rect.top < lineTop) lineTop = s.rect.top;
        if (s.rect.bottom > lineBottom) lineBottom = s.rect.bottom;
      }

      if (y < lineTop) {
        if (isDraggingDown && i > 0) {
          targetLine = sortedLines[i - 1][1];
        } else {
          targetLine = lineSpans;
        }
        break;
      }

      if (i === sortedLines.length - 1 && y > lineBottom) {
        targetLine = lineSpans;
      }
    }
  }

  if (!targetLine) return lastValidSpan || null;

  const sortedTargetLine = [...targetLine].sort((a, b) => a.rect.left - b.rect.left);

  for (const info of sortedTargetLine) {
    if (x >= info.rect.left && x <= info.rect.right) {
      return info;
    }
  }

  if (lastValidSpan) {
    const lastSpanInTargetLine = sortedTargetLine.find(s => s.span === lastValidSpan.span);
    if (lastSpanInTargetLine) {
      const lastSpanIndex = sortedTargetLine.indexOf(lastSpanInTargetLine);

      for (let i = 0; i < sortedTargetLine.length; i++) {
        const span = sortedTargetLine[i];
        const nextSpan = sortedTargetLine[i + 1];

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

  let closestSpan = sortedTargetLine[0];
  let minDist = Infinity;

  for (const info of sortedTargetLine) {
    const distLeft = Math.abs(x - info.rect.left);
    const distRight = Math.abs(x - info.rect.right);
    const dist = Math.min(distLeft, distRight);
    if (dist < minDist) {
      minDist = dist;
      closestSpan = info;
    }
  }

  if (x < sortedTargetLine[0].rect.left) {
    return sortedTargetLine[0];
  }

  if (x > sortedTargetLine[sortedTargetLine.length - 1].rect.right) {
    return sortedTargetLine[sortedTargetLine.length - 1];
  }

  return closestSpan;
}

export function getSnappedCaretInfo(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics,
  anchorY: number,
  lastValidSpan?: SpanInfo | null
): CaretInfo | null {
  const direct = getCaretInfoFromPoint(x, y);
  if (direct && textLayer.contains(direct.node)) {
    const parentSpan = (direct.node.parentElement?.closest('span[role="presentation"], span:not([role])') ||
      direct.node.parentElement) as HTMLElement | null;
    if (parentSpan) {
      const rect = parentSpan.getBoundingClientRect();
      const textNode = parentSpan.firstChild?.nodeType === Node.TEXT_NODE ? parentSpan.firstChild : null;
      const spanInfo = { span: parentSpan, rect, textNode };

      if (textNode && textNode.textContent) {
        const text = textNode.textContent;
        const charWidth = text.length > 0 ? rect.width / text.length : metrics.averageCharWidth;
        const relativeX = x - rect.left;
        let correctedOffset = Math.floor(relativeX / charWidth + 0.35);
        correctedOffset = Math.max(0, Math.min(correctedOffset, text.length));
        return {
          node: textNode,
          offset: correctedOffset,
          spanInfo
        };
      }

      return {
        node: direct.node,
        offset: direct.offset,
        spanInfo
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
  const clampedX = Math.min(Math.max(x, r.left), r.right);
  const clampedY = r.top + r.height / 2;

  const snapped = getCaretInfoFromPoint(clampedX, clampedY);
  if (snapped && textLayer.contains(snapped.node)) {
    return { ...snapped, spanInfo: bestSpan };
  }

  if (bestSpan.textNode) {
    const text = bestSpan.textNode.textContent || '';
    const charWidth = text.length > 0 ? r.width / text.length : metrics.averageCharWidth;
    const relativeX = x - r.left;
    let offset = Math.floor(relativeX / charWidth + 0.35);
    offset = Math.max(0, Math.min(offset, text.length));

    return { node: bestSpan.textNode, offset, spanInfo: bestSpan };
  }

  return direct ? { ...direct } : null;
}

export function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

export function isPointOverValidText(x: number, y: number, textLayer: Element, bufferPx: number = 3): boolean {
  const spans = textLayer.querySelectorAll('span[role="presentation"], span:not([role])');

  for (const span of spans) {
    if (!(span instanceof HTMLElement)) continue;
    if (!span.textContent?.trim()) continue;

    const rect = span.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    if (x >= rect.left - bufferPx && x <= rect.right + bufferPx &&
        y >= rect.top - bufferPx && y <= rect.bottom + bufferPx) {
      return true;
    }
  }

  return false;
}

export interface HysteresisState {
  lastValidX: number;
  lastValidY: number;
  lastValidTime: number;
  isInGap: boolean;
  gapEntryTime: number;
}

export function createHysteresisState(): HysteresisState {
  return {
    lastValidX: 0,
    lastValidY: 0,
    lastValidTime: 0,
    isInGap: false,
    gapEntryTime: 0
  };
}

export function shouldHoldSelection(
  x: number,
  y: number,
  textLayer: Element,
  hysteresis: HysteresisState,
  thresholdMs: number = 60
): { hold: boolean; updatedHysteresis: HysteresisState } {
  const now = performance.now();
  const isOverText = isPointOverValidText(x, y, textLayer, 3);

  if (isOverText) {
    return {
      hold: false,
      updatedHysteresis: {
        lastValidX: x,
        lastValidY: y,
        lastValidTime: now,
        isInGap: false,
        gapEntryTime: 0
      }
    };
  }

  if (!hysteresis.isInGap) {
    incrementHysteresisHolds();
    logSelectionEvent('hysteresis:enter-gap', { x, y });
    return {
      hold: true,
      updatedHysteresis: {
        ...hysteresis,
        isInGap: true,
        gapEntryTime: now
      }
    };
  }

  const timeInGap = now - hysteresis.gapEntryTime;
  if (timeInGap < thresholdMs) {
    return {
      hold: true,
      updatedHysteresis: hysteresis
    };
  }

  logSelectionEvent('hysteresis:threshold-exceeded', { timeInGap });
  return {
    hold: false,
    updatedHysteresis: hysteresis
  };
}

export function selectWordAtPoint(
  x: number,
  y: number,
  textLayer: Element,
  metrics: TextMetrics
): Range | null {
  const caretInfo = getSnappedCaretInfo(x, y, textLayer, metrics, y, null);
  if (!caretInfo || !caretInfo.node) return null;

  const textNode = caretInfo.node.nodeType === Node.TEXT_NODE
    ? caretInfo.node
    : caretInfo.node.firstChild;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

  const text = textNode.textContent || '';
  let offset = Math.min(caretInfo.offset, text.length);

  if (offset > 0 && offset === text.length) {
    offset--;
  }

  if (text.length === 0 || !isWordChar(text[offset])) {
    if (offset > 0 && isWordChar(text[offset - 1])) {
      offset--;
    } else {
      return null;
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

  if (currentSpanIndex < 0) return null;

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

  const range = document.createRange();
  range.setStart(finalStartNode, finalStartOffset);
  range.setEnd(finalEndNode, finalEndOffset);

  return range;
}

export function calculatePageRects(
  container: HTMLElement,
  range: Range,
  clearOverlay: () => void
): Map<number, SelectionRect[]> {
  const clientRects = range.getClientRects();
  const pageRectsMap = new Map<number, SelectionRect[]>();

  if (clientRects.length === 0) {
    return pageRectsMap;
  }

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
    return pageRectsMap;
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

  return pageRectsMap;
}

export function applyRangeToSelection(
  range: Range,
  isProgrammaticRef: React.MutableRefObject<boolean>,
  lastAppliedRangeRef: React.MutableRefObject<RangeSignature | null>,
  selectionEpochRef: React.MutableRefObject<number>
): boolean {
  const newSignature = getRangeSignature(range);

  if (areRangesEqual(lastAppliedRangeRef.current, newSignature)) {
    logSelectionEvent('apply-range:identical-skip');
    return false;
  }

  const selection = window.getSelection();
  if (!selection) return false;

  const currentEpoch = ++selectionEpochRef.current;
  isProgrammaticRef.current = true;

  try {
    selection.removeAllRanges();
    selection.addRange(range);
    lastAppliedRangeRef.current = newSignature;
    logSelectionEvent('apply-range:success', { epoch: currentEpoch });
    return true;
  } finally {
    requestAnimationFrame(() => {
      if (selectionEpochRef.current === currentEpoch) {
        isProgrammaticRef.current = false;
      }
    });
  }
}

export function createSelectionRange(
  anchorNode: Node,
  anchorOffset: number,
  focusNode: Node,
  focusOffset: number
): Range {
  const range = document.createRange();

  const position = anchorNode.compareDocumentPosition(focusNode);
  const isBefore = position & Node.DOCUMENT_POSITION_FOLLOWING ||
                   (anchorNode === focusNode && anchorOffset <= focusOffset);

  if (isBefore) {
    range.setStart(anchorNode, anchorOffset);
    range.setEnd(focusNode, focusOffset);
  } else {
    range.setStart(focusNode, focusOffset);
    range.setEnd(anchorNode, anchorOffset);
  }

  return range;
}
