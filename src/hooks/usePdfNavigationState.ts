import { useCallback, useRef, useState } from 'react';
import type { UsePdfNavigationStateParams } from '../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: encapsular estado e rastreamento do input de paginação manual.
 * Limites: não executa navegação nem valida limites de páginas; apenas guarda estado e telemetria do input.
 */
export const usePdfNavigationState = ({ logEvent, getCurrentPage, currentPageRef }: UsePdfNavigationStateParams) => {
  const [pageInputValue, setPageInputValue] = useState<string>('');
  const pageInputSequenceRef = useRef<string>('');
  const pageInputTickRef = useRef<number>(0);

  const handleSetPageInputValue = useCallback((value: string) => {
    const tickId = ++pageInputTickRef.current;
    const previousValue = pageInputSequenceRef.current;
    const isLinearSequence =
      value.length >= previousValue.length
        ? value.startsWith(previousValue)
        : previousValue.startsWith(value);

    logEvent('page_input_sequence_tick', {
      tickId,
      previousValue,
      nextValue: value,
      isLinearSequence,
      currentPageRef: currentPageRef.current,
      currentPageState: getCurrentPage()
    });

    pageInputSequenceRef.current = value;
    setPageInputValue(value);
  }, [currentPageRef, getCurrentPage, logEvent]);

  return {
    pageInputValue,
    handleSetPageInputValue,
    setPageInputValue,
    pageInputSequenceRef,
    pageInputTickRef
  };
};
