import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelectionRect,
  TextMetrics,
  RangeSignature,
  areMapsEqual,
  getTextMetricsFromTextLayer,
  selectWordAtPoint,
  calculatePageRects,
  applyRangeToSelection,
  logSelectionEvent,
  incrementDroppedEvents
} from './selectionEngine';

export type { SelectionRect };

export interface SelectionOverlayResult {
  selectionsByPage: Map<number, SelectionRect[]>;
  hasSelection: boolean;
  clearSelection: () => void;
}

const DRAG_THROTTLE_MS = 16;

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
  const isDraggingRef = useRef(false);
  const hasActiveSelectionRef = useRef(false);
  const lastSelectionTextRef = useRef('');
  const isKeyboardSelectingRef = useRef(false);
  const currentTextMetricsRef = useRef<TextMetrics | null>(null);

  const isProgrammaticSelectionRef = useRef(false);
  const selectionEpochRef = useRef(0);
  const lastAppliedRangeRef = useRef<RangeSignature | null>(null);

  const selectionUpdateTokenRef = useRef(0);
  const dragUpdateThrottleRef = useRef<number>(0);

  const rafCoalesceRef = useRef<{
    pending: boolean;
    forceUpdate: boolean;
  }>({ pending: false, forceUpdate: false });

  const clearOverlay = useCallback(() => {
    if (lastRectsMapRef.current.size === 0 && !hasActiveSelectionRef.current) {
      return;
    }
    logSelectionEvent('overlay:clear');
    lastRectsMapRef.current = new Map();
    hasActiveSelectionRef.current = false;
    lastSelectionTextRef.current = '';
    setSelectionsByPage(new Map());
    setHasSelection(false);
  }, []);

  const flushOverlayUpdate = useCallback((pageRectsMap: Map<number, SelectionRect[]>, selectionText: string) => {
    const hasChanged = !areMapsEqual(lastRectsMapRef.current, pageRectsMap);

    if (!hasChanged && !rafCoalesceRef.current.forceUpdate) {
      return;
    }

    lastRectsMapRef.current = pageRectsMap;
    hasActiveSelectionRef.current = true;
    lastSelectionTextRef.current = selectionText;
    setSelectionsByPage(new Map(pageRectsMap));
    setHasSelection(true);
    logSelectionEvent('overlay:update', { pages: pageRectsMap.size, rects: Array.from(pageRectsMap.values()).flat().length });
  }, []);

  const calculateSelectionRects = useCallback((forceUpdate = false) => {
    const selection = document.getSelection();
    const selectionText = selection?.toString() || '';

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (isMouseDownRef.current && isDraggingRef.current && lastRectsMapRef.current.size > 0) {
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
    const pageRectsMap = calculatePageRects(container, range, clearOverlay);

    if (pageRectsMap.size > 0) {
      rafCoalesceRef.current.forceUpdate = forceUpdate;
      flushOverlayUpdate(pageRectsMap, selectionText);
      rafCoalesceRef.current.forceUpdate = false;
    }
  }, [containerRef, clearOverlay, flushOverlayUpdate]);

  const scheduleRafUpdate = useCallback((forceUpdate: boolean) => {
    selectionUpdateTokenRef.current++;
    const currentToken = selectionUpdateTokenRef.current;

    if (rafCoalesceRef.current.pending) {
      rafCoalesceRef.current.forceUpdate = rafCoalesceRef.current.forceUpdate || forceUpdate;
      return;
    }

    rafCoalesceRef.current.pending = true;
    rafCoalesceRef.current.forceUpdate = forceUpdate;

    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current);
    }

    pendingRafRef.current = requestAnimationFrame(() => {
      rafCoalesceRef.current.pending = false;

      if (selectionUpdateTokenRef.current !== currentToken) {
        incrementDroppedEvents();
        pendingRafRef.current = null;
        return;
      }

      calculateSelectionRects(rafCoalesceRef.current.forceUpdate);
      pendingRafRef.current = null;
    });
  }, [calculateSelectionRects]);

  const handleSelectionChange = useCallback(() => {
    if (isProgrammaticSelectionRef.current) {
      logSelectionEvent('selectionchange:blocked-programmatic');
      return;
    }

    if (isKeyboardSelectingRef.current) {
      logSelectionEvent('selectionchange:blocked-keyboard');
      return;
    }

    logSelectionEvent('selectionchange:process', { isDragging: isDraggingRef.current });
    scheduleRafUpdate(isDraggingRef.current);
  }, [scheduleRafUpdate]);

  const clearSelection = useCallback(() => {
    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current);
      pendingRafRef.current = null;
    }

    selectionUpdateTokenRef.current++;
    selectionEpochRef.current++;
    lastAppliedRangeRef.current = null;

    const selection = window.getSelection();
    if (selection) {
      isProgrammaticSelectionRef.current = true;
      try {
        selection.removeAllRanges();
      } finally {
        requestAnimationFrame(() => {
          isProgrammaticSelectionRef.current = false;
        });
      }
    }

    isDraggingRef.current = false;
    clearOverlay();
    logSelectionEvent('selection:cleared');
  }, [clearOverlay]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      isMouseDownRef.current = true;

      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (textLayer) {
        currentTextMetricsRef.current = getTextMetricsFromTextLayer(textLayer);
        isDraggingRef.current = true;
        logSelectionEvent('mousedown:text-layer', { x: e.clientX, y: e.clientY });
      } else {
        logSelectionEvent('mousedown:outside');
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
      if (!isMouseDownRef.current || !isDraggingRef.current) return;

      const now = performance.now();
      if (now - dragUpdateThrottleRef.current < DRAG_THROTTLE_MS) {
        return;
      }
      dragUpdateThrottleRef.current = now;

      scheduleRafUpdate(true);
    };

    const handleMouseUp = () => {
      const wasDragging = isDraggingRef.current;
      isMouseDownRef.current = false;
      isDraggingRef.current = false;

      if (wasDragging) {
        logSelectionEvent('mouseup:end-drag');
        scheduleRafUpdate(true);
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (!textLayer) return;

      e.preventDefault();

      const metrics = getTextMetricsFromTextLayer(textLayer);
      currentTextMetricsRef.current = metrics;

      const range = selectWordAtPoint(e.clientX, e.clientY, textLayer, metrics);

      if (range) {
        const applied = applyRangeToSelection(
          range,
          isProgrammaticSelectionRef,
          lastAppliedRangeRef,
          selectionEpochRef
        );

        if (applied) {
          logSelectionEvent('dblclick:word-selected');
          scheduleRafUpdate(true);
        }
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
        logSelectionEvent('keyup:keyboard-selection-end');
        scheduleRafUpdate(true);
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
  }, [clearSelection, scheduleRafUpdate]);

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
