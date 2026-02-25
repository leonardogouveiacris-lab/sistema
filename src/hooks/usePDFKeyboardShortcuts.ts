import { useEffect } from 'react';
import type { UsePDFKeyboardShortcutsParams } from '../types/FloatingPDFViewerContracts';

const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown']);

export function usePDFKeyboardShortcuts({
  onToggleSearch,
  onPreviousPage,
  onNextPage,
  onGoToPage,
  totalPagesRef,
  keyboardNavigationThrottleMsRef,
  keyboardNavRefs,
  lockDurationMs,
  cooldownDurationMs,
}: UsePDFKeyboardShortcutsParams) {
  useEffect(() => {
    const lastHandledRepeatByKey = new Map<string, number>();
    const pressedNavigationKeys = new Set<string>();

    const handleKeyUp = (e: KeyboardEvent) => {
      if (NAVIGATION_KEYS.has(e.key)) {
        pressedNavigationKeys.delete(e.key);

        const now = Date.now();
        const elapsedSinceLastInput = now - keyboardNavRefs.lastInputAtRef.current;
        const hasRecentKeyboardNavigation = elapsedSinceLastInput <= lockDurationMs * 2;

        if (hasRecentKeyboardNavigation) {
          keyboardNavRefs.cooldownUntilRef.current = now + cooldownDurationMs;
          keyboardNavRefs.stableFramesRef.current = 0;
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        onToggleSearch();
        return;
      }

      const target = e.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const now = Date.now();

      if (NAVIGATION_KEYS.has(e.key)) {
        keyboardNavRefs.lastInputAtRef.current = now;
        const wasPressed = pressedNavigationKeys.has(e.key);
        pressedNavigationKeys.add(e.key);

        if (e.repeat || wasPressed) {
          const lastHandledAt = lastHandledRepeatByKey.get(e.key) ?? 0;
          const elapsed = now - lastHandledAt;
          const navigationThrottleMs = keyboardNavigationThrottleMsRef.current;

          if (elapsed < navigationThrottleMs) {
            e.preventDefault();
            return;
          }

          lastHandledRepeatByKey.set(e.key, now);
        }
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          onPreviousPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          onNextPage();
          break;
        case 'Home':
          e.preventDefault();
          onGoToPage(1);
          break;
        case 'End':
          e.preventDefault();
          onGoToPage(totalPagesRef.current);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [cooldownDurationMs, keyboardNavRefs, keyboardNavigationThrottleMsRef, lockDurationMs, onGoToPage, onNextPage, onPreviousPage, onToggleSearch, totalPagesRef]);
}
