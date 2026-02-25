import { useRef, useState } from 'react';
import type { BookmarkDocumentMap } from '../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: armazenar estado e controle de ciclo de vida da extração/merge de bookmarks.
 * Limites: não extrai bookmarks por conta própria; a orquestração e chamadas de serviço ficam no componente raiz.
 */
export const usePdfBookmarks = () => {
  const [documentBookmarks, setDocumentBookmarks] = useState<BookmarkDocumentMap>(new Map());
  const bookmarkExtractionInFlightRef = useRef<Set<string>>(new Set());
  const bookmarkExtractionLoadedRef = useRef<Set<string>>(new Set());
  const bookmarkExtractionFailedRef = useRef<Set<string>>(new Set());
  const mergedBookmarksFingerprintRef = useRef<string | null>(null);

  return {
    documentBookmarks,
    setDocumentBookmarks,
    bookmarkExtractionInFlightRef,
    bookmarkExtractionLoadedRef,
    bookmarkExtractionFailedRef,
    mergedBookmarksFingerprintRef
  };
};
