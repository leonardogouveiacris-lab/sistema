import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import logger from '../../utils/logger';

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
    setSearchQuery,
    setSearchResults,
    goToNextSearchResult,
    goToPreviousSearchResult,
    setIsSearching,
    goToPage
  } = usePDFViewer();

  const [localQuery, setLocalQuery] = useState(state.searchQuery);
  const [searchComplete, setSearchComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastNavigatedQueryRef = useRef<string>('');
  const debouncedQuery = useDebounce(localQuery, 300);

  useEffect(() => {
    if (state.isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isSearchOpen]);

  useEffect(() => {
    if (!state.isSearchOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSearchComplete(false);
      lastNavigatedQueryRef.current = '';
      setLocalQuery('');
    }
  }, [state.isSearchOpen]);

  const searchFromDatabase = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !processId) {
      setSearchResults([]);
      setSearchComplete(true);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      abortControllerRef.current = new AbortController();

      const { data, error } = await supabase.rpc('search_pdf_text', {
        p_process_id: processId,
        p_query: query,
        p_limit: 500
      });

      if (error) {
        logger.error('Database search error', 'PDFSearchPopup.searchFromDatabase', error);
        setSearchResults([]);
        setSearchComplete(true);
        return;
      }

      const dbResults = (data || []) as DatabaseSearchResult[];

      const results = dbResults.map((row, index) => {
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

      setSearchResults(results);
      setSearchComplete(true);

      logger.info(
        `Database search: "${query}" - ${results.length} results`,
        'PDFSearchPopup.searchFromDatabase'
      );
    } catch (error) {
      logger.error('Search error', 'PDFSearchPopup.searchFromDatabase', error);
      setSearchResults([]);
      setSearchComplete(true);
    } finally {
      setIsSearching(false);
    }
  }, [processId, documentOffsets, setSearchResults, setIsSearching, setSearchQuery]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      lastNavigatedQueryRef.current = '';
      setSearchComplete(true);
      return;
    }

    searchFromDatabase(debouncedQuery);
  }, [debouncedQuery, searchFromDatabase, setSearchResults]);

  useEffect(() => {
    if (
      state.searchResults.length > 0 &&
      state.searchQuery &&
      lastNavigatedQueryRef.current !== state.searchQuery
    ) {
      lastNavigatedQueryRef.current = state.searchQuery;
      goToPage(state.searchResults[0].globalPageNumber);
    }
  }, [state.searchResults, state.searchQuery, goToPage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPreviousSearchResult();
      } else {
        goToNextSearchResult();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  }, [goToNextSearchResult, goToPreviousSearchResult, closeSearch]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isSearchOpen) {
        e.preventDefault();
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [state.isSearchOpen, closeSearch]);

  if (!state.isSearchOpen) return null;

  const hasResults = state.searchResults.length > 0;
  const noResults = localQuery.length >= 2 && !state.isSearching && state.searchResults.length === 0 && searchComplete;

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
              onChange={(e) => setLocalQuery(e.target.value)}
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
              disabled={!hasResults}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Resultado anterior (Shift+Enter)"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={goToNextSearchResult}
              disabled={!hasResults}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Proximo resultado (Enter)"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-300" />

          <button
            onClick={closeSearch}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Fechar (Esc)"
          >
            <X size={16} />
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
