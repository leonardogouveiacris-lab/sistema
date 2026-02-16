/**
 * PDFBookmarkPanel - Painel de navegação por bookmarks/índices do PDF
 *
 * Features:
 * - Renderiza estrutura hierárquica de bookmarks
 * - Suporte a expansão/colapso de grupos
 * - Busca e filtro de bookmarks
 * - Navegação ao clicar em bookmark
 * - Indicação visual da página atual
 * - Estados de carregamento e erro
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { PDFBookmark } from '../../types/PDFBookmark';
import { filterBookmarks, countTotalBookmarks } from '../../utils/pdfBookmarkExtractor';
import { BookOpen, ChevronRight, ChevronDown, FileText, Search, AlertCircle } from 'lucide-react';
import { Tooltip } from '../ui';
import { useDebounce } from '../../hooks/useDebounce';

const BOOKMARK_ROW_HEIGHT = 36;
const BOOKMARK_OVERSCAN = 6;

interface VisibleBookmarkItem {
  bookmark: PDFBookmark;
  level: number;
  bookmarkId: string;
}


const PDFBookmarkPanel: React.FC = () => {
  const {
    state,
    navigateToPageWithHighlight
  } = usePDFViewer();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredBookmarks = useMemo(() => {
    return filterBookmarks(state.bookmarks, debouncedSearchQuery);
  }, [state.bookmarks, debouncedSearchQuery]);

  const totalBookmarks = useMemo(() => {
    return countTotalBookmarks(state.bookmarks);
  }, [state.bookmarks]);

  const hasBookmarks = state.bookmarks.length > 0;
  const currentDocumentId = state.documents[state.currentDocumentIndex]?.id;

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const updateViewportHeight = () => {
      setViewportHeight(container.clientHeight);
    };

    updateViewportHeight();

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [hasBookmarks]);

  useEffect(() => {
    setScrollTop(0);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    setSearchQuery('');
    setExpandedItems(new Set());
    setExpandAll(false);
    setScrollTop(0);

    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [currentDocumentId]);

  const handleBookmarkClick = (bookmark: PDFBookmark) => {
    if (bookmark.pageNumber) {
      navigateToPageWithHighlight(bookmark.pageNumber);
    }
  };

  const toggleExpanded = (bookmarkId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookmarkId)) {
        newSet.delete(bookmarkId);
      } else {
        newSet.add(bookmarkId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpandedItems(new Set());
    } else {
      const allIds = new Set<string>();
      const collectIds = (bookmarks: PDFBookmark[], prefix: string = '') => {
        bookmarks.forEach((bookmark, index) => {
          const id = `${prefix}${index}`;
          if (bookmark.items && bookmark.items.length > 0) {
            allIds.add(id);
            collectIds(bookmark.items, `${id}-`);
          }
        });
      };
      collectIds(state.bookmarks);
      setExpandedItems(allIds);
    }
    setExpandAll(!expandAll);
  };

  const visibleBookmarks = useMemo(() => {
    const flatVisible: VisibleBookmarkItem[] = [];

    const collectVisibleBookmarks = (
      bookmarks: PDFBookmark[],
      level: number = 0,
      prefix: string = ''
    ) => {
      bookmarks.forEach((bookmark, index) => {
        const bookmarkId = `${prefix}${index}`;
        flatVisible.push({ bookmark, level, bookmarkId });

        const hasChildren = bookmark.items && bookmark.items.length > 0;
        const isExpanded = expandAll || expandedItems.has(bookmarkId);

        if (hasChildren && isExpanded) {
          collectVisibleBookmarks(bookmark.items, level + 1, `${bookmarkId}-`);
        }
      });
    };

    collectVisibleBookmarks(filteredBookmarks);
    return flatVisible;
  }, [filteredBookmarks, expandedItems, expandAll]);

  const virtualizedRange = useMemo(() => {
    const totalItems = visibleBookmarks.length;

    if (totalItems === 0) {
      return { startIndex: 0, endIndex: 0, offsetY: 0 };
    }

    const effectiveViewportHeight = viewportHeight || totalItems * BOOKMARK_ROW_HEIGHT;
    const visibleCount = Math.ceil(effectiveViewportHeight / BOOKMARK_ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / BOOKMARK_ROW_HEIGHT) - BOOKMARK_OVERSCAN);
    const endIndex = Math.min(totalItems, startIndex + visibleCount + BOOKMARK_OVERSCAN * 2);

    return {
      startIndex,
      endIndex,
      offsetY: startIndex * BOOKMARK_ROW_HEIGHT
    };
  }, [visibleBookmarks.length, scrollTop, viewportHeight]);

  const virtualizedBookmarks = useMemo(() => {
    return visibleBookmarks.slice(virtualizedRange.startIndex, virtualizedRange.endIndex);
  }, [visibleBookmarks, virtualizedRange.startIndex, virtualizedRange.endIndex]);

  const renderBookmarkRow = ({ bookmark, level, bookmarkId }: VisibleBookmarkItem): React.ReactNode => {
    const hasChildren = bookmark.items && bookmark.items.length > 0;
    const isExpanded = expandedItems.has(bookmarkId) || expandAll;
    const isCurrentPage = bookmark.pageNumber === state.currentPage;
    const pageInfo = bookmark.pageNumber ? `p. ${bookmark.pageNumber}` : '';

    const titleStyle = {
      fontWeight: bookmark.bold ? 'bold' : 'normal',
      fontStyle: bookmark.italic ? 'italic' : 'normal'
    };

    return (
      <div key={bookmarkId} className="select-none" style={{ height: BOOKMARK_ROW_HEIGHT }}>
        <div
          onClick={() => handleBookmarkClick(bookmark)}
          className={`group flex items-center space-x-2 px-2 py-2 hover:bg-gray-100 rounded cursor-pointer transition-colors ${
            isCurrentPage ? 'bg-blue-50 border-l-2 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${8 + level * 16}px`, height: BOOKMARK_ROW_HEIGHT }}
        >
          {hasChildren && (
            <button
              onClick={(e) => toggleExpanded(bookmarkId, e)}
              className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-600" />
              ) : (
                <ChevronRight size={14} className="text-gray-600" />
              )}
            </button>
          )}

          {!hasChildren && (
            <div className="flex-shrink-0 w-4" />
          )}

          <FileText size={14} className={`flex-shrink-0 ${isCurrentPage ? 'text-blue-600' : 'text-gray-400'}`} />

          <div className="flex-1 min-w-0 flex items-center justify-between gap-2 overflow-hidden">
            <Tooltip
              content={bookmark.title}
              className="min-w-0 flex-1 overflow-hidden"
              position="right"
              maxWidth={680}
              tooltipClassName="bg-slate-200 border-slate-300 text-slate-800"
            >
              <span
                className={`block text-sm truncate ${
                  isCurrentPage ? 'text-blue-600 font-medium' : 'text-gray-700'
                }`}
                style={titleStyle}
              >
                {bookmark.title}
              </span>
            </Tooltip>

            {pageInfo && (
              <span className="text-xs text-gray-500 flex-shrink-0">
                {pageInfo}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (state.isLoadingBookmarks && !hasBookmarks) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-sm text-gray-600">Carregando índice do PDF...</p>
      </div>
    );
  }

  if (state.bookmarksError && !hasBookmarks) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <p className="text-sm text-red-600 text-center mb-2">Erro ao carregar índice</p>
        <p className="text-xs text-gray-500 text-center">{state.bookmarksError}</p>
      </div>
    );
  }

  if (!hasBookmarks) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <BookOpen className="text-gray-400 mb-4" size={48} />
        <p className="text-sm text-gray-600 text-center mb-2">
          Este PDF não possui índice
        </p>
        <p className="text-xs text-gray-500 text-center">
          O documento não contém bookmarks/marcadores estruturados
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Índice do Documento
          </h3>
          <div className="flex items-center gap-2">
            {state.isLoadingBookmarks && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <span className="animate-spin inline-block w-3 h-3 border border-amber-600 border-t-transparent rounded-full" />
                atualizando índice...
              </span>
            )}
            <span className="text-xs text-gray-500">
              {totalBookmarks} {totalBookmarks === 1 ? 'item' : 'itens'}
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Buscar no índice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {state.bookmarks.some(b => b.items && b.items.length > 0) && (
          <button
            onClick={handleExpandAll}
            className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            {expandAll ? 'Recolher Tudo' : 'Expandir Tudo'}
          </button>
        )}

        {debouncedSearchQuery && (
          <div className="text-xs text-gray-600">
            {countTotalBookmarks(filteredBookmarks)} resultado(s) encontrado(s)
          </div>
        )}
      </div>

      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-2"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {filteredBookmarks.length > 0 ? (
          <div
            className="relative"
            style={{ height: visibleBookmarks.length * BOOKMARK_ROW_HEIGHT }}
          >
            <div
              className="absolute left-0 top-0 right-0"
              style={{ transform: `translateY(${virtualizedRange.offsetY}px)` }}
            >
              {virtualizedBookmarks.map((item) => renderBookmarkRow(item))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <Search className="text-gray-400 mb-3" size={40} />
            <p className="text-sm text-gray-600 text-center mb-2">
              Nenhum resultado encontrado
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpar busca
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PDFBookmarkPanel);
