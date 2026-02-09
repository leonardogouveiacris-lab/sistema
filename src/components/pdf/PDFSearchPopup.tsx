import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2, Check } from 'lucide-react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import { getCachedDocumentText } from '../../utils/pdfTextExtractor';
import type { SearchResult } from '../../utils/pdfTextExtractor';
import { buildPageSearchIndex, buildSearchResults, SearchOptions } from '../../utils/pdfLocalSearch';
import logger from '../../utils/logger';
import { searchLocalPdfText } from '../../services/pdfTextSearch.service';

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const normalizeQuery = (value: string): string =>
  value.normalize('NFD').replace(DIACRITICS_REGEX, '');

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

interface PDFSearchPopupProps {
  processId: string;
  documentOffsets: Map<string, { startPage: number; endPage: number; numPages: number }>;
}

interface DatabaseSearchResult {
  document_id: string;
  document_name: string;
  sequence_order: number;
  page_number: number;
  match_text: string;
  context_before: string;
  context_after: string;
}

const PDFSearchPopup: React.FC<PDFSearchPopupProps> = ({
  processId,
  documentOffsets
}) => {
  const {
    state,
    closeSearch,
    clearSearch,
    setSearchQuery,
    setSearchAnchorPage,
    setSearchResults,
    goToNextSearchResult,
    goToPreviousSearchResult,
    setIsSearching
  } = usePDFViewer();

  const [localQuery, setLocalQuery] = useState(state.searchQuery);
  const [searchComplete, setSearchComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastNavigatedQueryRef = useRef<string>('');
  const searchRequestIdRef = useRef(0);
  const localIndexRef = useRef<Map<string, Map<number, ReturnType<typeof buildPageSearchIndex>>>>(new Map());
  const indexProgressRef = useRef<{ current: number; total: number }>({ current: 0, total: 0 });
  const idleCallbackRef = useRef<number | null>(null);
  const localQueryRef = useRef<string>(localQuery);
  const isSearchOpenRef = useRef<boolean>(state.isSearchOpen);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0
  });
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [matchDiacritics, setMatchDiacritics] = useState(false);
  const debouncedQuery = useDebounce(localQuery, 300);

  const searchOptions = useMemo<SearchOptions>(() => ({
    matchCase,
    matchWholeWord,
    matchDiacritics
  }), [matchCase, matchWholeWord, matchDiacritics]);

  const scheduleIdleTask = useCallback((callback: (deadline: IdleDeadline) => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return window.requestIdleCallback(callback as any);
    }
    return window.setTimeout(() => {
      callback({ didTimeout: true, timeRemaining: () => 0 });
    }, 0);
  }, []);

  const cancelIdleTask = useCallback((id: number) => {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(id);
      return;
    }
    window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (state.isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isSearchOpen]);

  useEffect(() => {
    localQueryRef.current = localQuery;
  }, [localQuery]);

  useEffect(() => {
    isSearchOpenRef.current = state.isSearchOpen;
  }, [state.isSearchOpen]);

  const invalidateSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSearching(false);
  }, [setIsSearching]);

  useEffect(() => {
    if (!state.isSearchOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (idleCallbackRef.current) {
        cancelIdleTask(idleCallbackRef.current);
        idleCallbackRef.current = null;
      }
      setSearchComplete(false);
      lastNavigatedQueryRef.current = '';
      setLocalQuery('');
    }
  }, [state.isSearchOpen, cancelIdleTask]);

  const updateIndexProgress = useCallback((current: number, total: number) => {
    indexProgressRef.current = { current, total };
    setIndexProgress({ current, total });
    setIsIndexing(current < total);
  }, []);

  const buildLocalIndex = useCallback(async () => {
    if (!state.isSearchOpen) return;

    const documents = state.documents;
    if (documents.length === 0) return;

    const totalPages = documents.reduce((sum, doc) => {
      const docOffsets = documentOffsets.get(doc.id);
      return sum + (docOffsets?.numPages || 0);
    }, 0);

    const indexedPages = Array.from(localIndexRef.current.values())
      .reduce((sum, pageMap) => sum + pageMap.size, 0);
    updateIndexProgress(indexedPages, totalPages);

    for (const doc of documents) {
      if (!state.isSearchOpen) return;
      if (localIndexRef.current.has(doc.id)) continue;
      const cached = await getCachedDocumentText(doc.id);
      if (!cached) {
        continue;
      }

      const pageIndexMap = new Map<number, ReturnType<typeof buildPageSearchIndex>>();
      localIndexRef.current.set(doc.id, pageIndexMap);
      const pageNumbers = Array.from(cached.pages.keys()).sort((a, b) => a - b);
      let cursor = 0;

      const buildChunk = (deadline: IdleDeadline) => {
        while (cursor < pageNumbers.length && (deadline.timeRemaining() > 8 || deadline.didTimeout)) {
          const pageNumber = pageNumbers[cursor];
          const pageContent = cached.pages.get(pageNumber);
          if (pageContent) {
            pageIndexMap.set(pageNumber, buildPageSearchIndex(pageContent));
          }
          cursor += 1;
          updateIndexProgress(indexProgressRef.current.current + 1, totalPages);
        }

        if (cursor < pageNumbers.length && state.isSearchOpen) {
          idleCallbackRef.current = scheduleIdleTask(buildChunk);
        }
      };

      idleCallbackRef.current = scheduleIdleTask(buildChunk);
    }
  }, [documentOffsets, scheduleIdleTask, state.documents, state.isSearchOpen, updateIndexProgress]);

  useEffect(() => {
    if (state.isSearchOpen) {
      buildLocalIndex();
    }
  }, [buildLocalIndex, state.isSearchOpen]);

  const searchLocal = useCallback((query: string): SearchResult[] => {
    if (!query || query.length < 2) return [];
    const results: SearchResult[] = [];
    let matchOffset = 0;

    state.documents.forEach((doc, docIndex) => {
      const pageIndexMap = localIndexRef.current.get(doc.id);
      const docOffset = documentOffsets.get(doc.id);
      if (!pageIndexMap || !docOffset) return;

      const sortedPages = Array.from(pageIndexMap.keys()).sort((a, b) => a - b);
      sortedPages.forEach((pageNumber) => {
        const pageIndex = pageIndexMap.get(pageNumber);
        if (!pageIndex) return;
        const globalPageNumber = docOffset.startPage + pageNumber - 1;
        const pageResults = buildSearchResults(
          doc.id,
          docIndex,
          pageIndex,
          query,
          searchOptions,
          matchOffset,
          globalPageNumber
        );
        if (pageResults.length > 0) {
          results.push(...pageResults);
          matchOffset += pageResults.length;
        }
      });
    });

    return results;
  }, [documentOffsets, searchOptions, state.documents]);

  const buildLocalSearchResults = useCallback((query: string) => {
    const indexedPages = Array.from(localIndexRef.current.values())
      .reduce((sum, pageMap) => sum + pageMap.size, 0);

    if (indexedPages === 0) {
      return { results: [], hasIndexedContent: false };
    }

    return {
      results: searchLocal(query),
      hasIndexedContent: true
    };
  }, [searchLocal]);

  const fetchDatabaseResults = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!query || query.length < 2 || !processId) {
      return [];
    }

    const runSearch = async (term: string) => {
      return supabase.rpc('search_pdf_text', {
        p_process_id: processId,
        p_query: term,
        p_limit: 500
      });
    };

    const { data, error } = await runSearch(query);
    if (error) {
      logger.error('Database search error', 'PDFSearchPopup.fetchDatabaseResults', undefined, error);
      return [];
    }

    let dbResults = (data || []) as DatabaseSearchResult[];
    const normalizedQuery = normalizeQuery(query);
    const shouldRetry = dbResults.length === 0 && normalizedQuery !== query;

    if (shouldRetry) {
      const retry = await runSearch(normalizedQuery);
      if (!retry.error) {
        dbResults = (retry.data || []) as DatabaseSearchResult[];
      }
    }

    return dbResults.map((row, index) => {
      const docOffset = documentOffsets.get(row.document_id);
      const globalPageNumber = docOffset
        ? docOffset.startPage + row.page_number - 1
        : row.page_number;

      return {
        documentId: row.document_id,
        documentIndex: row.sequence_order - 1,
        globalPageNumber,
        localPageNumber: row.page_number,
        matchIndex: index,
        matchStart: 0,
        matchEnd: row.match_text.length,
        contextBefore: row.context_before || '',
        matchText: row.match_text,
        contextAfter: row.context_after || ''
      };
    });
  }, [processId, documentOffsets]);

  const searchWithFallback = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchComplete(true);
      return;
    }

    invalidateSearch();

    setIsSearching(true);
    setSearchQuery(query);

    try {
      const localSearch = buildLocalSearchResults(query);
      if (localSearch.hasIndexedContent) {
        setSearchResults(localSearch.results);
        setSearchComplete(true);
        return;
      }

      if (!processId) {
        setSearchResults([]);
        setSearchComplete(true);
        return;
      }

      const currentRequestId = ++searchRequestIdRef.current;
      abortControllerRef.current = new AbortController();

      const { results: localResults, searchedDocumentIds, missingDocumentIds } = searchLocalPdfText({
        query,
        documents: state.documents,
        documentOffsets
      });

      if (
        abortControllerRef.current?.signal.aborted ||
        currentRequestId !== searchRequestIdRef.current ||
        !isSearchOpenRef.current ||
        localQueryRef.current !== query
      ) {
        return;
      }

      let combinedResults = localResults;

      if (missingDocumentIds.size > 0 && processId) {
        const dbResults = await fetchDatabaseResults(query);
        if (abortControllerRef.current?.signal.aborted || currentRequestId !== searchRequestIdRef.current) {
          return;
        }

        const filteredDbResults = dbResults.filter(result => !searchedDocumentIds.has(result.documentId));
        combinedResults = [...localResults, ...filteredDbResults];
      }

      const indexedResults = combinedResults.map((result, index) => ({
        ...result,
        matchIndex: index
      }));

      setSearchResults(indexedResults);
      setSearchComplete(true);

      logger.info(
        `Search: "${query}" - ${indexedResults.length} results (local ${localResults.length})`,
        'PDFSearchPopup.searchWithFallback'
      );
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      logger.error('Search error', 'PDFSearchPopup.searchWithFallback', undefined, error);
      setSearchResults([]);
      setSearchComplete(true);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, [documentOffsets, fetchDatabaseResults, processId, setIsSearching, setSearchQuery, setSearchResults, state.documents]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      lastNavigatedQueryRef.current = '';
      setSearchComplete(true);
      return;
    }

    searchWithFallback(debouncedQuery);
  }, [debouncedQuery, searchWithFallback, setSearchResults]);

  useEffect(() => {
    const hasResults = state.searchResults.length > 0;
    if (!hasResults || !state.searchQuery || !searchComplete) {
      return;
    }

    if (lastNavigatedQueryRef.current === state.searchQuery) {
      return;
    }

    lastNavigatedQueryRef.current = state.searchQuery;
  }, [state.searchResults, state.searchQuery, searchComplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        if (isIndexing) {
          return;
        }
        goToPreviousSearchResult();
      } else {
        setSearchComplete(false);
        lastNavigatedQueryRef.current = '';
        setSearchAnchorPage(state.currentPage);
        searchWithFallback(localQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      invalidateSearch();
      closeSearch();
    }
  }, [
    closeSearch,
    goToPreviousSearchResult,
    isIndexing,
    localQuery,
    searchWithFallback,
    setSearchAnchorPage,
    state.currentPage
  ]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isSearchOpen) {
        e.preventDefault();
        invalidateSearch();
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [state.isSearchOpen, closeSearch, invalidateSearch]);

  if (!state.isSearchOpen) return null;

  const hasResults = state.searchResults.length > 0;
  const noResults = localQuery.length >= 2 && !state.isSearching && state.searchResults.length === 0 && searchComplete;
  const extractionProgress = state.textExtractionProgress;
  const navigationDisabled = !hasResults || isIndexing;

  return (
    <div className="absolute top-3 right-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center p-2 gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={localQuery}
              onChange={(e) => {
                const nextValue = e.target.value;
                setLocalQuery(nextValue);
                if (nextValue === '') {
                  invalidateSearch();
                  clearSearch();
                  setSearchQuery('');
                  setSearchComplete(true);
                  lastNavigatedQueryRef.current = '';
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pesquisar no PDF..."
              className={`w-56 pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                noResults ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
          </div>

          {state.isSearching && (
            <Loader2 size={16} className="animate-spin text-blue-500" />
          )}

          {isIndexing && extractionProgress && (
            <span className="text-xs text-blue-600">
              Indexando texto… {extractionProgress.current}/{extractionProgress.total}
            </span>
          )}

          {hasResults && (
            <div className="flex items-center text-xs text-gray-600 min-w-[60px] justify-center">
              <span className="font-medium">{state.currentSearchIndex + 1}</span>
              <span className="mx-0.5">/</span>
              <span>{state.searchResults.length}</span>
            </div>
          )}

          <div className="flex items-center gap-0.5">
            <button
              onClick={goToPreviousSearchResult}
              disabled={navigationDisabled}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Resultado anterior (Shift+Enter)"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={goToNextSearchResult}
              disabled={navigationDisabled}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Proximo resultado (Enter)"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-300" />

          <button
            onClick={() => {
              invalidateSearch();
              closeSearch();
            }}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Fechar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 pb-2 text-[11px] text-gray-600">
          <button
            type="button"
            onClick={() => setMatchCase(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
              matchCase ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200'
            }`}
          >
            {matchCase && <Check size={12} />}
            Match case
          </button>
          <button
            type="button"
            onClick={() => setMatchWholeWord(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
              matchWholeWord ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200'
            }`}
          >
            {matchWholeWord && <Check size={12} />}
            Palavra inteira
          </button>
          <button
            type="button"
            onClick={() => setMatchDiacritics(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
              matchDiacritics ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200'
            }`}
          >
            {matchDiacritics && <Check size={12} />}
            Diacríticos
          </button>
        </div>

        {noResults && (
          <div className="px-3 pb-2">
            <p className="text-xs text-red-600">
              Nenhum resultado encontrado para "{localQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFSearchPopup;
