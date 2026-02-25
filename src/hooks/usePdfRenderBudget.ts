import { useRef, useState } from 'react';

/**
 * Responsabilidade: centralizar caches e filas usados pela estratégia de renderização contínua/preload.
 * Limites: não decide quais páginas renderizar; somente mantém os estados consumidos pela estratégia no componente raiz.
 */
export const usePdfRenderBudget = () => {
  const [idlePages, setIdlePages] = useState<Set<number>>(new Set());
  const [visitedPages, setVisitedPages] = useState<Set<number>>(new Set());
  const [forceRenderPages, setForceRenderPages] = useState<Set<number>>(new Set());
  const [scrollRenderCache, setScrollRenderCache] = useState<Set<number>>(new Set());
  const scrollRenderCacheRecencyQueueRef = useRef<number[]>([]);

  return {
    idlePages,
    setIdlePages,
    visitedPages,
    setVisitedPages,
    forceRenderPages,
    setForceRenderPages,
    scrollRenderCache,
    setScrollRenderCache,
    scrollRenderCacheRecencyQueueRef
  };
};
