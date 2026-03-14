import { useCallback, useEffect, useRef } from 'react';

/**
 * Agenda tarefas de baixa prioridade (idle/timeout) e garante cleanup no unmount.
 * API pequena e estável para evitar acoplamento com detalhes de scheduler.
 */
export const useFloatingViewerIdleTask = (defaultTimeoutMs: number) => {
  const pendingCancellersRef = useRef<Set<() => void>>(new Set());

  const scheduleIdleTask = useCallback((task: () => void, timeout = defaultTimeoutMs): (() => void) => {
    let cancelled = false;

    const runTask = () => {
      if (!cancelled) {
        task();
      }
      pendingCancellersRef.current.delete(cancel);
    };

    const cancel = () => {
      cancelled = true;
      pendingCancellersRef.current.delete(cancel);
      clear();
    };

    const clear = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (() => {
        const idleId = window.requestIdleCallback(runTask, { timeout });
        return () => window.cancelIdleCallback(idleId);
      })()
      : (() => {
        const timeoutId = window.setTimeout(runTask, 0);
        return () => window.clearTimeout(timeoutId);
      })();

    pendingCancellersRef.current.add(cancel);
    return cancel;
  }, [defaultTimeoutMs]);

  useEffect(() => {
    const pendingCancellers = pendingCancellersRef.current;

    return () => {
      pendingCancellers.forEach(cancel => cancel());
      pendingCancellers.clear();
    };
  }, []);

  return { scheduleIdleTask };
};
