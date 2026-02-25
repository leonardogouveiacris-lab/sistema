import type React from 'react';
import { useCallback, useEffect } from 'react';

interface UsePDFScrollSyncParams {
  registerScrollContainer: (element: HTMLDivElement | null) => void;
  setScrollContainerElement: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollContainerElement: HTMLDivElement | null;
}

/**
 * Frequência de sincronização de scroll: o processamento pesado/visibilidade é delegado ao viewer
 * (batch em requestAnimationFrame + throttle) para manter fluidez e limitar commits por frame.
 */
export function usePDFScrollSync({
  registerScrollContainer,
  setScrollContainerElement,
  scrollContainerRef,
  scrollContainerElement,
}: UsePDFScrollSyncParams) {
  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    setScrollContainerElement(node);
  }, [scrollContainerRef, setScrollContainerElement]);

  useEffect(() => {
    registerScrollContainer(scrollContainerElement);
    return () => {
      registerScrollContainer(null);
    };
  }, [registerScrollContainer, scrollContainerElement]);

  return { handleScrollContainerRef };
}
