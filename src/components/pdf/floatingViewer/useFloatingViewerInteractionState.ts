import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';

interface UseFloatingViewerInteractionStateParams {
  debounceMs: number;
  isInteracting: boolean;
  setIsInteracting: (value: boolean) => void;
  disableSearchNavigationSync: () => void;
  isSearchNavigationActive: () => boolean;
  isProgrammaticScrollRef: React.MutableRefObject<boolean>;
}

/**
 * Encapsula estado transitório de interação (scroll/zoom/drag) com timeout de estabilização.
 */
export const useFloatingViewerInteractionState = ({
  debounceMs,
  isInteracting,
  setIsInteracting,
  disableSearchNavigationSync,
  isSearchNavigationActive,
  isProgrammaticScrollRef
}: UseFloatingViewerInteractionStateParams) => {
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markInteractionStart = useCallback(() => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }

    if (!isInteracting) {
      setIsInteracting(true);
    }

    if (!isProgrammaticScrollRef.current && !isSearchNavigationActive()) {
      disableSearchNavigationSync();
    }

    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      interactionTimeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs, disableSearchNavigationSync, isInteracting, isProgrammaticScrollRef, isSearchNavigationActive, setIsInteracting]);

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
    };
  }, []);

  return { markInteractionStart };
};
