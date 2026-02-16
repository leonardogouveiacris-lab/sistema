import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelectionRect,
  TextMetrics,
  RangeSignature,
  SpanInfo,
  areRangesEqual,
  getRangeSignature,
  areMapsEqual,
  getTextMetricsFromTextLayer,
  getSpansWithInfo,
  selectWordAtPoint,
  calculatePageRects,
  createSelectionRange,
  getSnappedCaretInfo,
  createHysteresisState,
  shouldHoldSelection
} from './selectionEngine';

export type { SelectionRect };

export interface SelectionOverlayResult {
  selectionsByPage: Map<number, SelectionRect[]>;
  hasSelection: boolean;
  selectionMode: SelectionMode;
  canWriteProgrammaticSelection: boolean;
  applySelectionSafely: (range: Range, source: SelectionProgrammaticSource) => boolean;
  registerContextCommit: () => void;
  clearSelection: () => void;
}

type SelectionMode = 'idle' | 'native-drag' | 'programmatic-click' | 'keyboard-extend';
type SelectionProgrammaticSource =
  | 'double-click-word'
  | 'caret-click'
  | 'caret-arrow'
  | 'caret-shift-arrow'
  | 'caret-shift-click'
  | 'caret-triple-click'
  | 'mouseup-finalize'
  | 'clear-selection';

const DRAG_THROTTLE_MS = 16;
const MOUSEUP_PROTECTION_MS = 100;

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
  const activeTextLayerRef = useRef<Element | null>(null);
  const cachedSpansRef = useRef<SpanInfo[] | null>(null);
  const selectionModeRef = useRef<SelectionMode>('idle');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('idle');

  const isProgrammaticSelectionRef = useRef(false);
  const selectionEpochRef = useRef(0);
  const lastAppliedRangeRef = useRef<RangeSignature | null>(null);
  const handledProgrammaticEpochRef = useRef<number | null>(null);
  const currentProgrammaticEpochRef = useRef<number | null>(null);
  const pendingProgrammaticResetRef = useRef<number | null>(null);

  const selectionUpdateTokenRef = useRef(0);
  const dragUpdateThrottleRef = useRef<number>(0);

  const dragAnchorRef = useRef<{ node: Node; offset: number; anchorY: number } | null>(null);
  const dragSyntheticRangeRef = useRef<Range | null>(null);
  const lastValidRangeRef = useRef<Range | null>(null);
  const lastValidRangeSignatureRef = useRef<RangeSignature | null>(null);
  const lastValidSpanRef = useRef<SpanInfo | null>(null);
  const lastValidCaretRef = useRef<{ x: number; y: number } | null>(null);
  const gapHysteresisRef = useRef(createHysteresisState());
  const mouseupProtectionUntilRef = useRef<number>(0);

  const rafCoalesceRef = useRef<{
    pending: boolean;
    forceUpdate: boolean;
  }>({ pending: false, forceUpdate: false });

  const updateSelectionMode = useCallback((nextMode: SelectionMode) => {
    if (selectionModeRef.current === nextMode) {
      return;
    }
    selectionModeRef.current = nextMode;
    setSelectionMode(nextMode);
  }, []);

  const beginProgrammaticSelection = useCallback(() => {
    const epoch = ++selectionEpochRef.current;
    currentProgrammaticEpochRef.current = epoch;
    isProgrammaticSelectionRef.current = true;

    if (pendingProgrammaticResetRef.current !== null) {
      cancelAnimationFrame(pendingProgrammaticResetRef.current);
      pendingProgrammaticResetRef.current = null;
    }

    return epoch;
  }, []);

  const endProgrammaticSelection = useCallback((epoch: number) => {
    pendingProgrammaticResetRef.current = requestAnimationFrame(() => {
      if (currentProgrammaticEpochRef.current !== epoch) {
        return;
      }
      isProgrammaticSelectionRef.current = false;
      currentProgrammaticEpochRef.current = null;
      pendingProgrammaticResetRef.current = null;
    });
  }, []);

  const applySelectionSafely = useCallback((range: Range, source: SelectionProgrammaticSource): boolean => {
    if (selectionModeRef.current === 'native-drag') {
      return false;
    }

    const newSignature = getRangeSignature(range);
    if (areRangesEqual(lastAppliedRangeRef.current, newSignature)) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const epoch = beginProgrammaticSelection();
    handledProgrammaticEpochRef.current = null;
    updateSelectionMode(source.includes('arrow') ? 'keyboard-extend' : 'programmatic-click');

    try {
      selection.removeAllRanges();
      selection.addRange(range);
      lastAppliedRangeRef.current = newSignature;
      lastValidRangeSignatureRef.current = newSignature;
      return true;
    } finally {
      endProgrammaticSelection(epoch);
    }
  }, [beginProgrammaticSelection, endProgrammaticSelection, updateSelectionMode]);

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

  const registerContextCommit = useCallback(() => {}, []);

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
  }, []);

  const calculateSelectionRects = useCallback((forceUpdate = false) => {
    const selection = document.getSelection();

    if (isDraggingRef.current && selectionModeRef.current === 'native-drag') {
      const container = containerRef.current;
      const syntheticRange = dragSyntheticRangeRef.current || lastValidRangeRef.current;

      if (!container || !syntheticRange) {
        return;
      }

      const signature = getRangeSignature(syntheticRange);
      if (areRangesEqual(lastValidRangeSignatureRef.current, signature) && !forceUpdate) {
        return;
      }

      lastValidRangeSignatureRef.current = signature;
      const pageRectsMap = calculatePageRects(container, syntheticRange);
      if (pageRectsMap.size > 0) {
        rafCoalesceRef.current.forceUpdate = forceUpdate;
        flushOverlayUpdate(pageRectsMap, syntheticRange.toString());
        rafCoalesceRef.current.forceUpdate = false;
      }
      return;
    }

    const selectionText = selection?.toString() || '';

    const isInProtectionPeriod = Date.now() < mouseupProtectionUntilRef.current;

    if (!selection || selection.rangeCount === 0) {
      if (isMouseDownRef.current && isDraggingRef.current && lastRectsMapRef.current.size > 0) {
        return;
      }
      if (hasActiveSelectionRef.current && lastRectsMapRef.current.size > 0 && !forceUpdate) {
        return;
      }
      if (isInProtectionPeriod && lastRectsMapRef.current.size > 0) {
        return;
      }
      if (lastRectsMapRef.current.size > 0 && !isMouseDownRef.current) {
        clearOverlay();
      }
      return;
    }

    if (selection.isCollapsed) {
      if (isDraggingRef.current && lastValidRangeRef.current) {
        return;
      }

      if (isInProtectionPeriod && lastRectsMapRef.current.size > 0) {
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
    const signature = getRangeSignature(range);
    if (isDraggingRef.current && areRangesEqual(lastValidRangeSignatureRef.current, signature)) {
      return;
    }

    if (isDraggingRef.current) {
      lastValidRangeSignatureRef.current = signature;
    }
    const pageRectsMap = calculatePageRects(container, range);

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
        pendingRafRef.current = null;
        return;
      }

      calculateSelectionRects(rafCoalesceRef.current.forceUpdate);
      pendingRafRef.current = null;
    });
  }, [calculateSelectionRects]);

  const handleSelectionChange = useCallback(() => {
    const programmaticEpoch = currentProgrammaticEpochRef.current;
    if (isProgrammaticSelectionRef.current && programmaticEpoch !== null) {
      if (handledProgrammaticEpochRef.current === programmaticEpoch) {
        return;
      }
      handledProgrammaticEpochRef.current = programmaticEpoch;
      return;
    }

    const latestEpoch = selectionEpochRef.current;
    if (handledProgrammaticEpochRef.current !== null && handledProgrammaticEpochRef.current < latestEpoch - 1) {
      return;
    }

    if (isProgrammaticSelectionRef.current) {
      return;
    }

    if (isKeyboardSelectingRef.current) {
      return;
    }

    if (isDraggingRef.current) {
      return;
    }

    if (Date.now() < mouseupProtectionUntilRef.current) {
      return;
    }

    scheduleRafUpdate(false);
  }, [scheduleRafUpdate]);

  const clearSelection = useCallback(() => {
    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current);
      pendingRafRef.current = null;
    }

    selectionUpdateTokenRef.current++;
    const epoch = beginProgrammaticSelection();
    lastAppliedRangeRef.current = null;

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    endProgrammaticSelection(epoch);

    isDraggingRef.current = false;
    activeTextLayerRef.current = null;
    cachedSpansRef.current = null;
    dragAnchorRef.current = null;
    dragSyntheticRangeRef.current = null;
    lastValidRangeRef.current = null;
    lastValidSpanRef.current = null;
    gapHysteresisRef.current = createHysteresisState();
    updateSelectionMode('idle');
    clearOverlay();
  }, [beginProgrammaticSelection, clearOverlay, endProgrammaticSelection, updateSelectionMode]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      isMouseDownRef.current = true;

      const target = e.target as HTMLElement;
      const textLayer = target.closest('.textLayer') || target.closest('.react-pdf__Page__textContent');

      if (textLayer) {
        const metrics = getTextMetricsFromTextLayer(textLayer);
        currentTextMetricsRef.current = metrics;
        activeTextLayerRef.current = textLayer;
        cachedSpansRef.current = getSpansWithInfo(textLayer);

        const clickedCaret = getSnappedCaretInfo(
          e.clientX,
          e.clientY,
          textLayer,
          metrics,
          e.clientY,
          null
        );

        if (e.shiftKey && clickedCaret) {
          let anchorNode: Node | null = null;
          let anchorOffset: number = 0;
          let anchorY: number = e.clientY;

          if (dragAnchorRef.current) {
            anchorNode = dragAnchorRef.current.node;
            anchorOffset = dragAnchorRef.current.offset;
            anchorY = dragAnchorRef.current.anchorY;
          } else {
            const selection = window.getSelection();
            if (selection && selection.anchorNode && textLayer.contains(selection.anchorNode)) {
              anchorNode = selection.anchorNode;
              anchorOffset = selection.anchorOffset;
            }
          }

          if (anchorNode) {
            e.preventDefault();

            const extendedRange = createSelectionRange(
              anchorNode,
              anchorOffset,
              clickedCaret.node,
              clickedCaret.offset
            );

            if (!dragAnchorRef.current) {
              dragAnchorRef.current = {
                node: anchorNode,
                offset: anchorOffset,
                anchorY: anchorY
              };
            }

            dragSyntheticRangeRef.current = extendedRange;
            lastValidRangeRef.current = extendedRange;
            lastValidRangeSignatureRef.current = getRangeSignature(extendedRange);
            lastValidSpanRef.current = clickedCaret.spanInfo ?? lastValidSpanRef.current;
            lastValidCaretRef.current = { x: e.clientX, y: e.clientY };

            applySelectionSafely(extendedRange, 'caret-shift-click');
            scheduleRafUpdate(true);

            isDraggingRef.current = true;
            updateSelectionMode('native-drag');
            return;
          }
        }

        isDraggingRef.current = true;
        gapHysteresisRef.current = createHysteresisState();
        updateSelectionMode('native-drag');

        if (clickedCaret) {
          dragAnchorRef.current = {
            node: clickedCaret.node,
            offset: clickedCaret.offset,
            anchorY: e.clientY
          };
          lastValidSpanRef.current = clickedCaret.spanInfo ?? null;
          const initialRange = createSelectionRange(
            clickedCaret.node,
            clickedCaret.offset,
            clickedCaret.node,
            clickedCaret.offset
          );
          dragSyntheticRangeRef.current = initialRange;
          lastValidRangeRef.current = initialRange;
          lastValidRangeSignatureRef.current = getRangeSignature(initialRange);
        } else {
          dragAnchorRef.current = null;
        }
        lastValidCaretRef.current = { x: e.clientX, y: e.clientY };
      } else {
        updateSelectionMode('idle');
      }

      if (hasActiveSelectionRef.current && !textLayer) {
        const isOnSelectionOverlay = target.closest('[data-selection-overlay]');
        const isOnTextSelectionPopup = target.closest('[data-text-selection-popup]');
        const isOnInlineForm = target.closest('[data-inline-form]');

        if (!isOnSelectionOverlay && !isOnTextSelectionPopup && !isOnInlineForm) {
          clearSelection();
        }
      } else if (hasActiveSelectionRef.current && textLayer && !e.shiftKey) {
        lastAppliedRangeRef.current = null;
        lastValidRangeSignatureRef.current = null;
        clearOverlay();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current || !isDraggingRef.current) return;

      const now = performance.now();
      if (now - dragUpdateThrottleRef.current < DRAG_THROTTLE_MS) {
        return;
      }
      dragUpdateThrottleRef.current = now;

      const textLayer = activeTextLayerRef.current;
      if (textLayer) {
        const anchor = dragAnchorRef.current;
        const metrics = currentTextMetricsRef.current;
        if (!anchor || !metrics) {
          return;
        }

        const hysteresisResult = shouldHoldSelection(
          e.clientX,
          e.clientY,
          textLayer,
          gapHysteresisRef.current,
          80,
          cachedSpansRef.current ?? undefined
        );
        gapHysteresisRef.current = hysteresisResult.updatedHysteresis;

        if (hysteresisResult.hold) {
          dragSyntheticRangeRef.current = lastValidRangeRef.current;
          scheduleRafUpdate(true);
          return;
        }

        const focusCaret = getSnappedCaretInfo(
          e.clientX,
          e.clientY,
          textLayer,
          metrics,
          anchor.anchorY,
          lastValidSpanRef.current
        );

        if (!focusCaret) {
          dragSyntheticRangeRef.current = lastValidRangeRef.current;
          scheduleRafUpdate(true);
          return;
        }

        lastValidSpanRef.current = focusCaret.spanInfo ?? lastValidSpanRef.current;
        const syntheticRange = createSelectionRange(
          anchor.node,
          anchor.offset,
          focusCaret.node,
          focusCaret.offset
        );
        dragSyntheticRangeRef.current = syntheticRange;
        lastValidRangeRef.current = syntheticRange;
        lastValidRangeSignatureRef.current = getRangeSignature(syntheticRange);
      }

      lastValidCaretRef.current = { x: e.clientX, y: e.clientY };
      scheduleRafUpdate(true);
    };

    const handleMouseUp = () => {
      const wasDragging = isDraggingRef.current;
      const finalSyntheticRange = dragSyntheticRangeRef.current || lastValidRangeRef.current;
      isMouseDownRef.current = false;
      isDraggingRef.current = false;

      if (wasDragging) {
        mouseupProtectionUntilRef.current = Date.now() + MOUSEUP_PROTECTION_MS;

        if (finalSyntheticRange) {
          applySelectionSafely(finalSyntheticRange, 'mouseup-finalize');

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const container = containerRef.current;
            if (container) {
              const pageRectsMap = calculatePageRects(container, range);
              if (pageRectsMap.size > 0) {
                flushOverlayUpdate(pageRectsMap, range.toString());
              }
            }
          }
        }
        updateSelectionMode('idle');
        activeTextLayerRef.current = null;
        cachedSpansRef.current = null;
        dragSyntheticRangeRef.current = null;
        lastValidRangeRef.current = null;
        lastValidRangeSignatureRef.current = null;
        lastValidSpanRef.current = null;
        gapHysteresisRef.current = createHysteresisState();
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
        const applied = applySelectionSafely(range, 'double-click-word');

        if (applied) {
          scheduleRafUpdate(true);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        isKeyboardSelectingRef.current = true;
        updateSelectionMode('keyboard-extend');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isKeyboardSelectingRef.current && (e.key === 'Shift' || e.key.startsWith('Arrow'))) {
        isKeyboardSelectingRef.current = false;
        updateSelectionMode('idle');
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
  }, [applySelectionSafely, clearOverlay, clearSelection, containerRef, flushOverlayUpdate, scheduleRafUpdate, updateSelectionMode]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      if (pendingProgrammaticResetRef.current !== null) {
        cancelAnimationFrame(pendingProgrammaticResetRef.current);
        pendingProgrammaticResetRef.current = null;
      }
    };
  }, [handleSelectionChange]);

  return {
    selectionsByPage,
    hasSelection,
    selectionMode,
    canWriteProgrammaticSelection: selectionMode !== 'native-drag',
    applySelectionSafely,
    registerContextCommit,
    clearSelection
  };
}
