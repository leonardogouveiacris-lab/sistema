import type React from 'react';
import { useCallback, useEffect } from 'react';

interface UsePDFScrollSyncParams {
  registerScrollContainer: (element: HTMLDivElement | null) => void;
  setScrollContainerElement: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollContainerElement: HTMLDivElement | null;
}

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
