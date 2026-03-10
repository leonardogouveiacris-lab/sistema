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
  shouldHoldSelection,
  buildGlyphMapFromTextLayer,
  findClosestGlyphByPoint,
  createRangeFromGlyphs,
  getGlyphRectInPage,
  GlyphPosition,
  GlyphMap
} from './selectionEngine';

export type { SelectionRect };

export interface SelectionOverlayResult {
  selectionsByPage: Map<number, SelectionRect[]>;
  caretByPage: Map<number, SelectionRect>;
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

const MOUSEUP_PROTECTION_MS = 50;
const SCROLL_DEBOUNCE_MS = 16;

export function useSelectionOverlay(
  containerRef: React.RefObject<HTMLElement | null>
): SelectionOverlayResult {
  const [selectionsByPage, setSelectionsByPage] = useState<Map<number, SelectionRect[]>>(
    new Map()
  );
  const [hasSelection, setHasSelection] = useState(false);
  const [caretByPage, setCaretByPage] = useState<Map<number, SelectionRect>>(new Map());

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

  const dragAnchorRef = useRef<{ node: Node; offset: number; anchorY: number } | null>(null);
  const dragSyntheticRangeRef = useRef<Range | null>(null);
  const lastValidRangeRef = useRef<Range | null>(null);
  const lastValidRangeSignatureRef = useRef<RangeSignature | null>(null);
  const lastValidSpanRef = useRef<SpanInfo | null>(null);
  const lastValidCaretRef = useRef<{ x: number; y: number } | null>(null);
  const glyphMapRef = useRef<GlyphMap | null>(null);
  const caretGlyphRef = useRef<GlyphPosition | null>(null);
  const selectionAnchorGlyphRef = useRef<GlyphPosition | null>(null);
  const gapHysteresisRef = useRef(createHysteresisState());
  const mouseupProtectionUntilRef = useRef<number>(0);

  const rafCoalesceRef = useRef<{
    pending: boolean;
    forceUpdate: boolean;
  }>({ pending: false, forceUpdate: false });

  const scrollDebounceRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);

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

  const updateCaretOverlayFromGlyph = useCallback((glyph: GlyphPosition | null) => {
    caretGlyphRef.current = glyph;

    if (!glyph) {
      setCaretByPage(new Map());
      return;
    }

    const pageEl = glyph.span.closest('[data-global-page]');
    const textLayer = glyph.span.closest('.textLayer, .react-pdf__Page__textContent');
    if (!pageEl || !textLayer) {
      setCaretByPage(new Map());
      return;
    }

    const pageRect = pageEl.getBoundingClientRect();
    const textLayerRect = textLayer.getBoundingClientRect();
    const caretRect = getGlyphRectInPage(glyph, textLayerRect, pageRect);
    setCaretByPage(new Map([[glyph.pageNumber, caretRect]]));
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
      const skipRecalc = areRangesEqual(lastValidRangeSignatureRef.current, signature) &&
                         !forceUpdate &&
                         !isScrollingRef.current;
      if (skipRecalc) {
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
    const skipDragRecalc = isDraggingRef.current &&
                           areRangesEqual(lastValidRangeSignatureRef.current, signature) &&
                           !isScrollingRef.current &&
                           !forceUpdate;
    if (skipDragRecalc) {
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

    if (forceUpdate) {
      rafCoalesceRef.current.forceUpdate = true;
    }

    if (pendingRafRef.current !== null) {
      return;
    }

    const executeUpdate = () => {
      pendingRafRef.current = null;
      const shouldForce = rafCoalesceRef.current.forceUpdate;
      rafCoalesceRef.current.forceUpdate = false;
      calculateSelectionRects(shouldForce);
    };

    pendingRafRef.current = requestAnimationFrame(executeUpdate);
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

    if (isDraggingRef.current && !isScrollingRef.current) {
      return;
    }

    if (Date.now() < mouseupProtectionUntilRef.current && !isScrollingRef.current) {
      return;
    }

    scheduleRafUpdate(isScrollingRef.current);
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
    glyphMapRef.current = null;
    selectionAnchorGlyphRef.current = null;
    updateCaretOverlayFromGlyph(null);
    updateSelectionMode('idle');
    clearOverlay();
  }, [beginProgrammaticSelection, clearOverlay, endProgrammaticSelection, updateCaretOverlayFromGlyph, updateSelectionMode]);

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
        glyphMapRef.current = buildGlyphMapFromTextLayer(textLayer);

        const clickedCaret = getSnappedCaretInfo(
          e.clientX,
          e.clientY,
          textLayer,
          metrics,
          e.clientY,
          null
        );

        const glyphMap = glyphMapRef.current;
        const clickedGlyph = glyphMap ? findClosestGlyphByPoint(glyphMap, e.clientX, e.clientY) : null;

        if (e.shiftKey && clickedGlyph && selectionAnchorGlyphRef.current) {
          e.preventDefault();

          const extendedRange = createRangeFromGlyphs(selectionAnchorGlyphRef.current, clickedGlyph);

          dragAnchorRef.current = {
            node: selectionAnchorGlyphRef.current.textNode,
            offset: selectionAnchorGlyphRef.current.offset,
            anchorY: e.clientY
          };

          dragSyntheticRangeRef.current = extendedRange;
          lastValidRangeRef.current = extendedRange;
          lastValidRangeSignatureRef.current = getRangeSignature(extendedRange);
          lastValidSpanRef.current = clickedCaret?.spanInfo ?? lastValidSpanRef.current;
          lastValidCaretRef.current = { x: e.clientX, y: e.clientY };
          updateCaretOverlayFromGlyph(clickedGlyph);

          applySelectionSafely(extendedRange, 'caret-shift-click');
          scheduleRafUpdate(true);

          isDraggingRef.current = true;
          updateSelectionMode('native-drag');
          return;
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
          if (clickedGlyph) {
            selectionAnchorGlyphRef.current = clickedGlyph;
            updateCaretOverlayFromGlyph(clickedGlyph);
          }
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
        clearSelection();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current || !isDraggingRef.current) return;

      const textLayer = activeTextLayerRef.current;
      if (!textLayer) return;

      const anchor = dragAnchorRef.current;
      const metrics = currentTextMetricsRef.current;
      if (!anchor || !metrics) return;

      lastValidCaretRef.current = { x: e.clientX, y: e.clientY };

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

      const glyphMap = glyphMapRef.current;
      const focusGlyph = glyphMap ? findClosestGlyphByPoint(glyphMap, e.clientX, e.clientY) : null;
      const focusCaret = focusGlyph ? {
        node: focusGlyph.textNode,
        offset: focusGlyph.offset,
        spanInfo: lastValidSpanRef.current ?? undefined
      } : getSnappedCaretInfo(
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
      if (focusGlyph) {
        updateCaretOverlayFromGlyph(focusGlyph);
      }
      const syntheticRange = createSelectionRange(
        anchor.node,
        anchor.offset,
        focusCaret.node,
        focusCaret.offset
      );

      const prevSig = lastValidRangeSignatureRef.current;
      const newSig = getRangeSignature(syntheticRange);
      const rangeChanged = !areRangesEqual(prevSig, newSig);

      dragSyntheticRangeRef.current = syntheticRange;
      lastValidRangeRef.current = syntheticRange;
      lastValidRangeSignatureRef.current = newSig;

      if (!rangeChanged) {
        return;
      }

      const container = containerRef.current;
      if (container) {
        const pageRectsMap = calculatePageRects(container, syntheticRange);
        if (pageRectsMap.size > 0) {
          flushOverlayUpdate(pageRectsMap, syntheticRange.toString());
        }
      }
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
        dragSyntheticRangeRef.current = null;
        lastValidRangeRef.current = null;
        lastValidRangeSignatureRef.current = null;
        lastValidSpanRef.current = null;
        gapHysteresisRef.current = createHysteresisState();
      }
    };

    // Fonte única de verdade para seleção por duplo clique.
    // Todo gesto de double-click deve passar exclusivamente por este fluxo
    // para evitar reaplicações concorrentes de applySelectionSafely(...).
    const handleDoubleClick = (e: MouseEvent) => {
      if (e.detail >= 3) {
        return;
      }

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
      const movable = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (movable.includes(e.key) && caretGlyphRef.current && glyphMapRef.current) {
        e.preventDefault();
        const glyphs = glyphMapRef.current.glyphs;
        const current = caretGlyphRef.current;
        const currentIndex = glyphs.findIndex((g) => g.index === current.index);
        if (currentIndex >= 0) {
          let target = current;
          if (e.key === 'ArrowLeft' && currentIndex > 0) target = glyphs[currentIndex - 1];
          if (e.key === 'ArrowRight' && currentIndex < glyphs.length - 1) target = glyphs[currentIndex + 1];
          if (e.key === 'Home') target = glyphs.find((g) => Math.abs(g.y - current.y) < 2) || target;
          if (e.key === 'End') {
            const sameLine = glyphs.filter((g) => Math.abs(g.y - current.y) < 2);
            target = sameLine[sameLine.length - 1] || target;
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const lines = glyphMapRef.current.lineGroups;
            const lineIndex = lines.findIndex((line) => line.some((g) => g.index === current.index));
            if (lineIndex >= 0) {
              const desiredLine = e.key === 'ArrowUp' ? lines[lineIndex - 1] : lines[lineIndex + 1];
              if (desiredLine?.length) {
                target = desiredLine.reduce((best, g) => Math.abs(g.x - current.x) < Math.abs(best.x - current.x) ? g : best, desiredLine[0]);
              }
            }
          }

          updateCaretOverlayFromGlyph(target);

          const anchorGlyph = e.shiftKey ? (selectionAnchorGlyphRef.current || current) : target;
          if (!e.shiftKey) selectionAnchorGlyphRef.current = target;

          const range = createRangeFromGlyphs(anchorGlyph, target);
          applySelectionSafely(range, e.shiftKey ? 'caret-shift-arrow' : 'caret-arrow');
          if (e.shiftKey) {
            scheduleRafUpdate(true);
            updateSelectionMode('keyboard-extend');
          }
          return;
        }
      }
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
  }, [applySelectionSafely, clearOverlay, clearSelection, containerRef, flushOverlayUpdate, scheduleRafUpdate, updateCaretOverlayFromGlyph, updateSelectionMode]);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!hasActiveSelectionRef.current && !isDraggingRef.current) {
        return;
      }

      isScrollingRef.current = true;

      if (scrollDebounceRef.current !== null) {
        cancelAnimationFrame(scrollDebounceRef.current);
      }

      scrollDebounceRef.current = requestAnimationFrame(() => {
        scheduleRafUpdate(true);

        setTimeout(() => {
          isScrollingRef.current = false;
        }, SCROLL_DEBOUNCE_MS);

        scrollDebounceRef.current = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollDebounceRef.current !== null) {
        cancelAnimationFrame(scrollDebounceRef.current);
        scrollDebounceRef.current = null;
      }
    };
  }, [containerRef, scheduleRafUpdate]);

  return {
    selectionsByPage,
    caretByPage,
    hasSelection,
    selectionMode,
    canWriteProgrammaticSelection: selectionMode !== 'native-drag',
    applySelectionSafely,
    registerContextCommit,
    clearSelection
  };
}
