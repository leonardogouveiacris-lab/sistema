import { useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { extractTextFromSelection } from '../utils/textFormatter';

interface LogPayload {
  page: number;
  currentPage: number;
  mode: string;
  reason: string;
  flagName: 'isPointerDownRef' | 'isSelectingTextRef';
}

interface UseTextSelectionGuardParams {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  isSelectingTextRef: MutableRefObject<boolean>;
  isPointerDownRef: MutableRefObject<boolean>;
  isPointerDownInPdfRef: MutableRefObject<boolean>;
  startedInsidePdfRef: MutableRefObject<boolean>;
  hasDragRef: MutableRefObject<boolean>;
  dragScrollBlockUntilRef: MutableRefObject<number>;
  textSelectionActivatedAtRef: MutableRefObject<number | null>;
  currentPageRef: MutableRefObject<number>;
  viewMode: string;
  pointerDownSafetyResetMs: number;
  textSelectionSafetyResetMs: number;
  textSelectionStaleResetMs: number;
  dragScrollBlockWindowMs: number;
  logPdfDebugEvent: (
    event: string,
    payload: LogPayload,
    options?: { throttleKey?: string; throttleMs?: number }
  ) => void;
}

export const useTextSelectionGuard = ({
  scrollContainerRef,
  isSelectingTextRef,
  isPointerDownRef,
  isPointerDownInPdfRef,
  startedInsidePdfRef,
  hasDragRef,
  dragScrollBlockUntilRef,
  textSelectionActivatedAtRef,
  currentPageRef,
  viewMode,
  pointerDownSafetyResetMs,
  textSelectionSafetyResetMs,
  textSelectionStaleResetMs,
  dragScrollBlockWindowMs,
  logPdfDebugEvent
}: UseTextSelectionGuardParams) => {
  const pointerDownSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textSelectionSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleSelectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logFlagTransition = (flagName: 'isPointerDownRef' | 'isSelectingTextRef', previous: boolean, next: boolean, reason: string) => {
      if (!(previous && !next)) return;

      logPdfDebugEvent(
        'text_selection_guard_reset',
        {
          page: currentPageRef.current,
          currentPage: currentPageRef.current,
          mode: viewMode,
          reason,
          flagName
        },
        { throttleKey: `text_selection_guard_reset:${flagName}:${reason}`, throttleMs: 2000 }
      );
    };

    const setPointerDownFlag = (nextValue: boolean, reason: string) => {
      const previous = isPointerDownRef.current;
      if (previous === nextValue) return;

      isPointerDownRef.current = nextValue;
      logFlagTransition('isPointerDownRef', previous, nextValue, reason);
    };

    const setSelectingTextFlag = (nextValue: boolean, reason: string) => {
      const previous = isSelectingTextRef.current;
      if (previous === nextValue) return;

      isSelectingTextRef.current = nextValue;
      logFlagTransition('isSelectingTextRef', previous, nextValue, reason);
    };

    const clearStaleSelectionTimeout = () => {
      if (!staleSelectionTimeoutRef.current) return;
      clearTimeout(staleSelectionTimeoutRef.current);
      staleSelectionTimeoutRef.current = null;
    };

    const scheduleStaleSelectionReset = (reason: string) => {
      clearStaleSelectionTimeout();

      if (isPointerDownRef.current || !isSelectingTextRef.current) return;

      staleSelectionTimeoutRef.current = setTimeout(() => {
        if (!isSelectingTextRef.current || isPointerDownRef.current) return;

        const selectionActivatedAt = textSelectionActivatedAtRef.current;
        if (!selectionActivatedAt) {
          logPdfDebugEvent(
            'text_selection_guard_reset',
            {
              page: currentPageRef.current,
              currentPage: currentPageRef.current,
              mode: viewMode,
              reason: `${reason}-stale-selection-without-activation`,
              flagName: 'isSelectingTextRef'
            },
            {
              throttleKey: 'text_selection_guard_reset:isSelectingTextRef:stale-selection-without-activation',
              throttleMs: 2000
            }
          );

          isSelectingTextRef.current = false;
          return;
        }

        if (Date.now() - selectionActivatedAt >= textSelectionStaleResetMs) {
          logPdfDebugEvent(
            'text_selection_guard_reset',
            {
              page: currentPageRef.current,
              currentPage: currentPageRef.current,
              mode: viewMode,
              reason: `${reason}-stale-selection-timeout`,
              flagName: 'isSelectingTextRef'
            },
            {
              throttleKey: 'text_selection_guard_reset:isSelectingTextRef:stale-selection-timeout',
              throttleMs: 2000
            }
          );

          isSelectingTextRef.current = false;
          textSelectionActivatedAtRef.current = null;
          startedInsidePdfRef.current = false;
        }
      }, textSelectionStaleResetMs);
    };

    const schedulePointerDownSafetyReset = () => {
      if (pointerDownSafetyTimeoutRef.current) {
        clearTimeout(pointerDownSafetyTimeoutRef.current);
      }

      pointerDownSafetyTimeoutRef.current = setTimeout(() => {
        setPointerDownFlag(false, 'pointerdown-safety-timeout');
        isPointerDownInPdfRef.current = false;
        hasDragRef.current = false;
      }, pointerDownSafetyResetMs);
    };

    const scheduleSelectionSafetyReset = (reason: string) => {
      if (textSelectionSafetyTimeoutRef.current) {
        clearTimeout(textSelectionSafetyTimeoutRef.current);
      }

      textSelectionSafetyTimeoutRef.current = setTimeout(() => {
        const scrollContainer = scrollContainerRef.current;
        const selection = window.getSelection();
        const selectedText = extractTextFromSelection(selection);
        const hasValidSelection = selectedText.length > 0;
        const anchorInPdf = !!(scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode));
        const focusInPdf = !!(scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode));
        const hasSelectionInPdf = hasValidSelection && anchorInPdf && focusInPdf;

        if (!hasSelectionInPdf) {
          setSelectingTextFlag(false, `${reason}-safety-timeout`);
          textSelectionActivatedAtRef.current = null;
          startedInsidePdfRef.current = false;
          clearStaleSelectionTimeout();
        }
      }, textSelectionSafetyResetMs);
    };

    const updateSelectionStateFromDom = () => {
      const scrollContainer = scrollContainerRef.current;
      const selection = window.getSelection();
      const selectedText = extractTextFromSelection(selection);
      const hasValidSelection = selectedText.length > 0;
      const anchorInPdf = !!(scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode));
      const focusInPdf = !!(scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode));
      const hasSelectionInPdf = hasValidSelection && anchorInPdf && focusInPdf;

      setSelectingTextFlag(hasSelectionInPdf, 'selectionchange');
      textSelectionActivatedAtRef.current = hasSelectionInPdf ? Date.now() : null;
      scheduleSelectionSafetyReset('selectionchange');

      if (hasSelectionInPdf) {
        scheduleStaleSelectionReset('selectionchange');
      } else {
        startedInsidePdfRef.current = false;
        clearStaleSelectionTimeout();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      setPointerDownFlag(true, 'pointerdown');
      schedulePointerDownSafetyReset();
      clearStaleSelectionTimeout();

      const target = e.target as HTMLElement;
      const isInsidePdf = scrollContainer.contains(target);
      const isInTextLayer = !!target.closest('.textLayer');
      const isInReactPdfPage = !!target.closest('.react-pdf__Page');
      startedInsidePdfRef.current = isInsidePdf || isInTextLayer || isInReactPdfPage;

      if (startedInsidePdfRef.current) {
        isPointerDownInPdfRef.current = true;
        hasDragRef.current = false;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPointerDownInPdfRef.current && (e.buttons === 1 || e.pressure > 0)) {
        schedulePointerDownSafetyReset();

        if (!hasDragRef.current) {
          hasDragRef.current = true;
          setSelectingTextFlag(true, 'pointermove-start-drag');
        }

        textSelectionActivatedAtRef.current = Date.now();
        dragScrollBlockUntilRef.current = Date.now() + dragScrollBlockWindowMs;
        scheduleSelectionSafetyReset('pointermove');
      }
    };

    const handlePointerUp = () => {
      const scrollContainer = scrollContainerRef.current;

      if (pointerDownSafetyTimeoutRef.current) {
        clearTimeout(pointerDownSafetyTimeoutRef.current);
        pointerDownSafetyTimeoutRef.current = null;
      }

      setPointerDownFlag(false, 'pointerup');

      const selection = window.getSelection();
      const selectedText = extractTextFromSelection(selection);
      const hasValidSelection = selectedText.length > 0;
      const anchorInPdf = !!(scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode));
      const focusInPdf = !!(scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode));
      const hasSelectionInPdf = hasValidSelection && anchorInPdf && focusInPdf;

      if (anchorInPdf && focusInPdf && hasSelectionInPdf) {
        setSelectingTextFlag(true, 'pointerup-valid-selection');
        textSelectionActivatedAtRef.current = Date.now();
        scheduleStaleSelectionReset('pointerup');
      } else {
        setSelectingTextFlag(false, 'pointerup-invalid-selection');
        textSelectionActivatedAtRef.current = null;
        startedInsidePdfRef.current = false;
        clearStaleSelectionTimeout();
      }

      scheduleSelectionSafetyReset('pointerup');

      isPointerDownInPdfRef.current = false;
      hasDragRef.current = false;
    };

    const handleKeyUp = () => {
      if (isSelectingTextRef.current && !isPointerDownRef.current) {
        scheduleStaleSelectionReset('keyup');
      }
    };

    document.addEventListener('selectionchange', updateSelectionStateFromDom);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('selectionchange', updateSelectionStateFromDom);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keyup', handleKeyUp);

      if (textSelectionSafetyTimeoutRef.current) {
        clearTimeout(textSelectionSafetyTimeoutRef.current);
        textSelectionSafetyTimeoutRef.current = null;
      }

      if (pointerDownSafetyTimeoutRef.current) {
        clearTimeout(pointerDownSafetyTimeoutRef.current);
        pointerDownSafetyTimeoutRef.current = null;
      }

      clearStaleSelectionTimeout();
    };
  }, [
    currentPageRef,
    dragScrollBlockUntilRef,
    dragScrollBlockWindowMs,
    hasDragRef,
    isPointerDownInPdfRef,
    isPointerDownRef,
    isSelectingTextRef,
    logPdfDebugEvent,
    pointerDownSafetyResetMs,
    scrollContainerRef,
    startedInsidePdfRef,
    textSelectionActivatedAtRef,
    textSelectionSafetyResetMs,
    textSelectionStaleResetMs,
    viewMode
  ]);
};
