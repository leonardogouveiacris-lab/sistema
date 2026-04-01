import { useEffect, useRef } from 'react';
import type { UsePDFTextSelectionEffectsParams } from '../types/FloatingPDFViewerContracts';

export function usePDFTextSelectionEffects({
  selectionMode,
  hasSelection,
  onHandleTextSelection,
  startedInsidePdfRef,
  scrollContainerRef,
  textSelectionDebounceRef,
}: UsePDFTextSelectionEffectsParams) {
  const onHandleTextSelectionRef = useRef(onHandleTextSelection);
  onHandleTextSelectionRef.current = onHandleTextSelection;

  useEffect(() => {
    const debouncedTextSelection = () => {
      if (textSelectionDebounceRef.current) {
        clearTimeout(textSelectionDebounceRef.current);
      }
      textSelectionDebounceRef.current = setTimeout(() => {
        textSelectionDebounceRef.current = null;
        const hasTextSelected = (window.getSelection()?.toString() || '').trim().length >= 3;
        if (selectionMode !== 'native-drag' || hasTextSelected) {
          onHandleTextSelectionRef.current();
        }
      }, 150);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
        const selection = window.getSelection();
        const text = selection?.toString() || '';
        if (text.length >= 3) {
          const scrollContainer = scrollContainerRef.current;
          if (scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode)) {
            startedInsidePdfRef.current = true;
            debouncedTextSelection();
          }
        }
      }
    };

    document.addEventListener('mouseup', debouncedTextSelection);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('mouseup', debouncedTextSelection);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [scrollContainerRef, selectionMode, startedInsidePdfRef, textSelectionDebounceRef]);

  useEffect(() => {
    return () => {
      if (textSelectionDebounceRef.current) {
        clearTimeout(textSelectionDebounceRef.current);
        textSelectionDebounceRef.current = null;
      }
    };
  }, [textSelectionDebounceRef]);

  useEffect(() => {
    if (hasSelection) {
      onHandleTextSelectionRef.current();
    }
  }, [hasSelection]);
}
