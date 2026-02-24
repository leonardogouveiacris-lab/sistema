import { useCallback } from 'react';
import type { UsePDFPageNavigationParams } from '../types/FloatingPDFViewerContracts';

export function usePDFPageNavigation({
  viewMode,
  currentPage,
  totalPages,
  isRotating,
  onNextPage,
  onPreviousPage,
  onGoToPage,
  onStartProgrammaticNavigation,
  onMarkProgrammaticScroll,
  keyboardNavLockDurationMs,
  keyboardNavRefs,
}: UsePDFPageNavigationParams) {
  const handleManualPageNavigation = useCallback((pageNum: number) => {
    if (viewMode === 'continuous') {
      onStartProgrammaticNavigation(pageNum, 'manual', true);
      return;
    }

    onGoToPage(pageNum);
  }, [onGoToPage, onStartProgrammaticNavigation, viewMode]);

  const handlePreviousPage = useCallback(() => {
    if (isRotating || currentPage <= 1) return;

    if (viewMode === 'continuous') {
      const targetPage = currentPage - 1;
      keyboardNavRefs.targetPageRef.current = targetPage;
      keyboardNavRefs.recentTargetPageRef.current = targetPage;
      keyboardNavRefs.lockUntilRef.current = Date.now() + keyboardNavLockDurationMs;
      keyboardNavRefs.targetReachedAtRef.current = null;
      keyboardNavRefs.stableFramesRef.current = 0;
      onMarkProgrammaticScroll('state-change');
    }

    onPreviousPage();
  }, [currentPage, isRotating, keyboardNavLockDurationMs, keyboardNavRefs, onMarkProgrammaticScroll, onPreviousPage, viewMode]);

  const handleNextPage = useCallback(() => {
    if (isRotating || currentPage >= totalPages) return;

    if (viewMode === 'continuous') {
      const targetPage = currentPage + 1;
      keyboardNavRefs.targetPageRef.current = targetPage;
      keyboardNavRefs.recentTargetPageRef.current = targetPage;
      keyboardNavRefs.lockUntilRef.current = Date.now() + keyboardNavLockDurationMs;
      keyboardNavRefs.targetReachedAtRef.current = null;
      keyboardNavRefs.stableFramesRef.current = 0;
      onMarkProgrammaticScroll('state-change');
    }

    onNextPage();
  }, [currentPage, isRotating, keyboardNavLockDurationMs, keyboardNavRefs, onMarkProgrammaticScroll, onNextPage, totalPages, viewMode]);

  return { handleManualPageNavigation, handlePreviousPage, handleNextPage };
}
