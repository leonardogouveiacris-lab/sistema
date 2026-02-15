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

import React, { useState, useMemo } from 'react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { PDFBookmark } from '../../types/PDFBookmark';
import { filterBookmarks, countTotalBookmarks } from '../../utils/pdfBookmarkExtractor';
import { BookOpen, ChevronRight, ChevronDown, FileText, Search, AlertCircle } from 'lucide-react';
import { Tooltip } from '../ui';

const PDFBookmarkPanel: React.FC = () => {
  const {
    state,
    navigateToPageWithHighlight
  } = usePDFViewer();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const filteredBookmarks = useMemo(() => {
    return filterBookmarks(state.bookmarks, searchQuery);
  }, [state.bookmarks, searchQuery]);

  const bookmarksProgress = useMemo(() => {
    const totalDocuments = state.documents.length;
    const doneDocuments = state.documents.filter(doc => state.bookmarksStatusByDoc.get(doc.id) === 'done').length;
    const loadingDocuments = state.documents.filter(doc => state.bookmarksStatusByDoc.get(doc.id) === 'loading').length;
    const errorDocuments = state.documents.filter(doc => state.bookmarksStatusByDoc.get(doc.id) === 'error').length;

    return {
      doneDocuments,
      totalDocuments,
      loadingDocuments,
      errorDocuments,
      progressLabel: `${doneDocuments}/${totalDocuments} documentos indexados`
    };
  }, [state.documents, state.bookmarksStatusByDoc]);

  const activeDocument = useMemo(() => {
    const docFromVisiblePage = state.documentPageInfo.find(info =>
      state.currentPage >= info.globalPageStart && state.currentPage <= info.globalPageEnd
    );

    if (docFromVisiblePage) {
      return state.documents[docFromVisiblePage.documentIndex] || null;
    }

    return state.documents[state.currentDocumentIndex] || null;
  }, [state.currentDocumentIndex, state.currentPage, state.documentPageInfo, state.documents]);

  const activeDocumentBookmarkStatus = useMemo(() => {
    if (!activeDocument) {
      return 'idle';
    }
    return state.bookmarksStatusByDoc.get(activeDocument.id) || 'idle';
  }, [activeDocument, state.bookmarksStatusByDoc]);

  const totalBookmarks = useMemo(() => {
    return countTotalBookmarks(state.bookmarks);
  }, [state.bookmarks]);

  const hasBookmarks = state.bookmarks.length > 0;

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

  const renderBookmark = (bookmark: PDFBookmark, level: number = 0, index: number, prefix: string = ''): React.ReactNode => {
    const hasChildren = bookmark.items && bookmark.items.length > 0;
    const bookmarkId = `${prefix}${index}`;
    const isExpanded = expandedItems.has(bookmarkId) || expandAll;
    const isCurrentPage = bookmark.pageNumber === state.currentPage;
    const pageInfo = bookmark.pageNumber ? `p. ${bookmark.pageNumber}` : '';

    const titleStyle = {
      fontWeight: bookmark.bold ? 'bold' : 'normal',
      fontStyle: bookmark.italic ? 'italic' : 'normal'
    };

    return (
      <div key={bookmarkId} className="select-none">
        <div
          onClick={() => handleBookmarkClick(bookmark)}
          className={`group flex items-center space-x-2 px-2 py-2 hover:bg-gray-100 rounded cursor-pointer transition-colors ${
            isCurrentPage ? 'bg-blue-50 border-l-2 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
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
            <Tooltip content={bookmark.title} className="min-w-0 flex-1 overflow-hidden">
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

        {hasChildren && isExpanded && (
          <div>
            {bookmark.items.map((child, childIndex) =>
              renderBookmark(child, level + 1, childIndex, `${bookmarkId}-`)
            )}
          </div>
        )}
      </div>
    );
  };

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
        <p className="text-xs text-blue-700 text-center mb-2 font-medium">
          {bookmarksProgress.progressLabel}
        </p>
        <p className="text-sm text-gray-600 text-center mb-2">
          {bookmarksProgress.doneDocuments >= bookmarksProgress.totalDocuments
            ? 'Este PDF não possui índice'
            : 'Indexando documentos para montar o índice'}
        </p>
        <p className="text-xs text-gray-500 text-center">
          {bookmarksProgress.doneDocuments >= bookmarksProgress.totalDocuments
            ? 'O documento não contém bookmarks/marcadores estruturados'
            : 'Você já pode navegar no PDF enquanto a indexação continua em segundo plano'}
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
            <span className="text-xs text-blue-700 font-medium">
              {bookmarksProgress.progressLabel}
            </span>
            {activeDocument && (
              <span className="text-xs text-gray-500">
                {activeDocument.displayName}: {activeDocumentBookmarkStatus === 'loading'
                  ? 'indexando'
                  : activeDocumentBookmarkStatus === 'done'
                    ? 'indexado'
                    : activeDocumentBookmarkStatus === 'error'
                      ? 'erro na indexação'
                      : 'pendente'}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {totalBookmarks} {totalBookmarks === 1 ? 'item' : 'itens'}
            </span>
          </div>
        </div>

        {bookmarksProgress.loadingDocuments > 0 && (
          <p className="text-xs text-amber-700">
            {bookmarksProgress.loadingDocuments} documento(s) em indexação
            {bookmarksProgress.errorDocuments > 0 ? ` • ${bookmarksProgress.errorDocuments} com erro` : ''}
          </p>
        )}

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

        {searchQuery && (
          <div className="text-xs text-gray-600">
            {countTotalBookmarks(filteredBookmarks)} resultado(s) encontrado(s)
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredBookmarks.length > 0 ? (
          <div className="space-y-0.5">
            {filteredBookmarks.map((bookmark, index) =>
              renderBookmark(bookmark, 0, index)
            )}
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
