/**
 * Contexto global para gerenciamento do visualizador de PDF
 *
 * Fornece estado compartilhado para:
 * - Controle de abertura/fechamento do visualizador
 * - Gerenciamento do documento atual
 * - Página e zoom do PDF
 * - Inserção de texto selecionado nos campos
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { ProcessDocument } from '../types/ProcessDocument';
import { PDFBookmark } from '../types/PDFBookmark';
import { PDFHighlight, HighlightColor } from '../types/Highlight';
import { PDFComment, PDFCommentConnector, CommentColor, ConnectorType } from '../types/PDFComment';
import { SearchResult } from '../utils/pdfTextExtractor';
import { countTotalBookmarks } from '../utils/pdfBookmarkExtractor';
import { PageRotationMap } from '../services/pageRotation.service';
import * as PageRotationService from '../services/pageRotation.service';
import logger from '../utils/logger';
import { findFirstIndexByBottom, findLastIndexByTop } from '../utils/pageVisibilityIndex';

const CONTINUOUS_PAGE_GAP_PX = 16;


/**
 * Interface para referências dos editores de texto
 * Permite inserir texto programaticamente
 */
export interface EditorRef {
  insertText: (text: string) => void;
  focus: () => void;
}

/**
 * Campos disponíveis para inserção de texto
 */
export type InsertionField = 'fundamentacao' | 'comentariosCalculistas' | 'comentariosDecisao' | 'comentariosDocumento';

/**
 * Modos do formulário no sidebar
 */
export type FormMode =
  | 'view'
  | 'create-decision'
  | 'create-verba'
  | 'create-documento'
  | 'create-documento-lancamento'
  | 'edit-decision'
  | 'edit-verba'
  | 'edit-documento'
  | 'edit-documento-lancamento';

/**
 * Abas disponíveis no sidebar
 */
export type SidebarTab = 'bookmarks' | 'decisions' | 'verbas' | 'documentos' | 'documentoLancamentos';

/**
 * Modos de visualização do PDF
 */
export type PDFViewMode = 'paginated' | 'continuous';
export type BookmarkLoadStatus = 'idle' | 'loading' | 'done' | 'error';

/**
 * Modo de performance - otimiza renderização desabilitando features pesadas
 */
export interface PerformanceMode {
  enabled: boolean;
  disableAnnotations: boolean;
}

/**
 * Informações sobre offset de páginas entre documentos
 */
export interface DocumentPageInfo {
  documentIndex: number;
  documentId: string;
  pageCountInDoc: number;
  globalPageStart: number;
  globalPageEnd: number;
}

/**
 * Posição da seleção de texto na tela
 */
export interface SelectionPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  viewportX?: number;
  viewportY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  pageNumber?: number;
}

/**
 * Interface do estado do PDF Viewer
 */
interface PDFViewerState {
  isOpen: boolean;
  documents: ProcessDocument[];
  currentDocumentIndex: number;
  currentPage: number;
  totalPages: number;
  zoom: number;
  displayZoom: number;
  isInteracting: boolean;
  selectedText: string;
  selectionPosition: SelectionPosition | null;
  isMinimized: boolean;
  panelWidth: number;
  sidebarTab: SidebarTab;
  formMode: FormMode;
  editingRecordId: string | null;
  highlightedPage: number | null;
  viewMode: PDFViewMode;
  bookmarks: PDFBookmark[];
  bookmarksStatusByDoc: Map<string, BookmarkLoadStatus>;
  isLoadingBookmarks: boolean;
  bookmarksError: string | null;
  isBookmarkPanelVisible: boolean;
  bookmarkPanelWidth: number;
  pageDimensions: Map<number, { width: number; height: number; internalRotation?: number }>;
  renderRange: number;
  documentPageInfo: DocumentPageInfo[];
  performanceMode: PerformanceMode;
  highlights: PDFHighlight[];
  isHighlighterActive: boolean;
  selectedHighlightColor: HighlightColor;
  hoveredHighlightId: string | null;
  selectedHighlightIds: string[];
  highlightIdsToLink: string[];
  isSearchOpen: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  searchAnchorPage: number | null;
  currentSearchIndex: number;
  isSearching: boolean;
  textExtractionProgress: { current: number; total: number } | null;
  pageRotations: PageRotationMap;
  isLoadingRotations: boolean;
  isRotationModalOpen: boolean;
  isRotating: boolean;
  rotationTargetPage: number | null;
  isPageExtractionModalOpen: boolean;
  isSidebarVisible: boolean;
  sidebarWidth: number;
  comments: PDFComment[];
  isCommentModeActive: boolean;
  selectedCommentId: string | null;
  selectedCommentColor: CommentColor;
  isDrawingConnector: boolean;
  drawingConnectorType: ConnectorType | null;
  editingConnectorId: string | null;
}

/**
 * Interface do contexto do PDF Viewer
 */
interface PDFViewerContextType {
  // Estado
  state: PDFViewerState;

  // Controle do visualizador
  openViewer: (documentsOrDocument: ProcessDocument | ProcessDocument[]) => void;
  closeViewer: () => void;
  toggleMinimize: () => void;

  // Helpers para múltiplos documentos
  getCurrentDocument: () => ProcessDocument | null;
  getDocumentByGlobalPage: (globalPage: number) => ProcessDocument | null;
  getLocalPageNumber: (globalPage: number) => number;
  getGlobalPageNumber: (documentIndex: number, localPage: number) => number;
  setDocumentPageInfo: (info: DocumentPageInfo[]) => void;

  // Navegação
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setTotalPages: (total: number) => void;
  navigateToPageWithHighlight: (page: number, recordId?: string) => void;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoom: (zoom: number) => void;
  setDisplayZoom: (zoom: number) => void;

  // Interaction state
  setIsInteracting: (isInteracting: boolean) => void;

  // Seleção de texto
  setSelectedText: (text: string, position?: SelectionPosition) => void;
  clearSelection: () => void;

  // Redimensionamento
  setPanelWidth: (width: number) => void;

  // Modo de visualização
  setViewMode: (mode: PDFViewMode) => void;
  toggleViewMode: () => void;

  // Sidebar e Forms
  setSidebarTab: (tab: SidebarTab) => void;
  setFormMode: (mode: FormMode) => void;
  startCreateDecision: () => void;
  startCreateVerba: () => void;
  startCreateDocumento: () => void;
  startCreateDocumentoLancamento: () => void;
  startEditDecision: (decisionId: string) => void;
  startEditVerba: (lancamentoId: string) => void;
  startEditDocumento: (documentoId: string) => void;
  startEditDocumentoLancamento: (documentoId: string) => void;
  cancelForm: () => void;

  // Referências dos editores
  registerEditor: (field: InsertionField, ref: EditorRef) => void;
  unregisterEditor: (field: InsertionField) => void;
  insertTextInField: (field: InsertionField, text: string) => boolean;

  // Bookmarks
  setBookmarks: (bookmarks: PDFBookmark[]) => void;
  setBookmarkStatusByDoc: (documentId: string, status: BookmarkLoadStatus) => void;
  resetBookmarksStatusByDoc: (documentIds?: string[]) => void;
  setIsLoadingBookmarks: (isLoading: boolean) => void;
  setBookmarksError: (error: string | null) => void;

  // Bookmark Panel
  toggleBookmarkPanel: () => void;
  setBookmarkPanelVisible: (visible: boolean) => void;
  setBookmarkPanelWidth: (width: number) => void;

  // Page Dimensions
  setPageDimensions: (pageNumber: number, dimensions: { width: number; height: number; internalRotation?: number }) => void;
  setPageDimensionsBatch: (entries: Array<[number, { width: number; height: number; internalRotation?: number }]>) => void;
  getPageHeight: (pageNumber: number) => number;
  getPageWidth: (pageNumber: number) => number;
  setRenderRange: (range: number) => void;
  getEffectiveRenderRange: () => number;
  registerScrollContainer: (container: HTMLDivElement | null) => void;
  getVisiblePageFromScroll: () => number | null;

  // Highlights
  setHighlights: (highlights: PDFHighlight[]) => void;
  addHighlight: (highlight: PDFHighlight) => void;
  removeHighlight: (highlightId: string) => void;
  updateHighlightColor: (highlightId: string, color: HighlightColor) => void;
  toggleHighlighter: () => void;
  setHighlighterActive: (active: boolean) => void;
  setSelectedHighlightColor: (color: HighlightColor) => void;
  setHoveredHighlightId: (highlightId: string | null) => void;
  getHighlightsByPage: (pageNumber: number) => PDFHighlight[];
  setSelectedHighlightIds: (highlightIds: string[]) => void;
  addHighlightIdToLink: (highlightId: string) => void;
  clearHighlightIdsToLink: () => void;
  scrollToMultipleHighlights: (highlightIds: string[], pageNumber?: number) => void;

  // Search
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  setSearchQuery: (query: string) => void;
  setSearchAnchorPage: (page: number | null) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setCurrentSearchIndex: (index: number) => void;
  goToNextSearchResult: () => void;
  goToPreviousSearchResult: () => void;
  setIsSearching: (isSearching: boolean) => void;
  disableSearchNavigationSync: () => void;
  isSearchNavigationActive: () => boolean;
  setTextExtractionProgress: (progress: { current: number; total: number } | null) => void;
  clearSearch: () => void;

  // Rotations
  getPageRotation: (pageNumber: number) => number;
  rotatePage: (pageNumber: number, degrees: number) => void;
  rotatePageBy: (pageNumber: number, delta: number) => void;
  rotatePages: (pageNumbers: number[], degrees: number) => void;
  rotatePagesBy: (pageNumbers: number[], delta: number) => void;
  resetPageRotation: (pageNumber: number) => void;
  resetAllRotations: () => void;
  openRotationModal: () => void;
  closeRotationModal: () => void;
  hasRotations: boolean;
  rotatedPageCount: number;
  openPageExtractionModal: () => void;
  closePageExtractionModal: () => void;

  // Sidebar
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setSidebarWidth: (width: number) => void;

  // Comments
  setComments: (comments: PDFComment[]) => void;
  addComment: (comment: PDFComment) => void;
  updateComment: (commentId: string, updates: Partial<PDFComment>) => void;
  removeComment: (commentId: string) => void;
  toggleCommentMode: () => void;
  setCommentModeActive: (active: boolean) => void;
  selectComment: (commentId: string | null) => void;
  setSelectedCommentColor: (color: CommentColor) => void;
  getCommentsByPage: (pageNumber: number) => PDFComment[];
  addConnectorToComment: (commentId: string, connector: PDFCommentConnector) => void;
  updateConnectorInComment: (commentId: string, connectorId: string, updates: Partial<PDFCommentConnector>) => void;
  removeConnectorFromComment: (commentId: string, connectorId: string) => void;
  setDrawingConnector: (isDrawing: boolean, type: ConnectorType | null) => void;
  setEditingConnectorId: (connectorId: string | null) => void;
}

/**
 * Calcula a largura padrão do painel baseado no tamanho da tela
 * Em telas compactas (<1200px), usa 100% da largura
 */
const getDefaultPanelWidth = (): number => {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  if (windowWidth < 1200) {
    return windowWidth;
  } else if (windowWidth < 1600) {
    return Math.floor(windowWidth * 0.92);
  }
  return Math.floor(windowWidth * 0.85);
};

/**
 * Calcula a largura responsiva da sidebar baseado no tamanho da tela
 */
const getDefaultSidebarWidth = (): number => {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  if (windowWidth < 1200) {
    return 300;
  } else if (windowWidth < 1600) {
    return 360;
  }
  return 400;
};

/**
 * Calcula a largura responsiva do painel de bookmarks
 */
const getDefaultBookmarkPanelWidth = (): number => {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  if (windowWidth < 1200) {
    return 260;
  } else if (windowWidth < 1600) {
    return 300;
  }
  return 360;
};

/**
 * Valores padrão do estado
 */
const DEFAULT_STATE: PDFViewerState = {
  isOpen: false,
  documents: [],
  currentDocumentIndex: 0,
  currentPage: 1,
  totalPages: 0,
  zoom: 1.0,
  displayZoom: 1.0,
  isInteracting: false,
  selectedText: '',
  selectionPosition: null,
  isMinimized: false,
  panelWidth: getDefaultPanelWidth(),
  sidebarTab: 'decisions',
  formMode: 'view',
  editingRecordId: null,
  highlightedPage: null,
  viewMode: 'paginated',
  bookmarks: [],
  bookmarksStatusByDoc: new Map(),
  isLoadingBookmarks: false,
  bookmarksError: null,
  isBookmarkPanelVisible: true,
  bookmarkPanelWidth: 400,
  pageDimensions: new Map(),
  renderRange: 1,
  documentPageInfo: [],
  performanceMode: {
    enabled: true,
    disableAnnotations: true
  },
  highlights: [],
  isHighlighterActive: false,
  selectedHighlightColor: 'yellow',
  hoveredHighlightId: null,
  selectedHighlightIds: [],
  highlightIdsToLink: [],
  isSearchOpen: false,
  searchQuery: '',
  searchResults: [],
  searchAnchorPage: null,
  currentSearchIndex: -1,
  isSearching: false,
  textExtractionProgress: null,
  pageRotations: {},
  isLoadingRotations: false,
  isRotationModalOpen: false,
  isRotating: false,
  rotationTargetPage: null,
  isPageExtractionModalOpen: false,
  isSidebarVisible: true,
  sidebarWidth: getDefaultSidebarWidth(),
  comments: [],
  isCommentModeActive: false,
  selectedCommentId: null,
  selectedCommentColor: 'yellow',
  isDrawingConnector: false,
  drawingConnectorType: null,
  editingConnectorId: null
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

/**
 * Cria o contexto
 */
const PDFViewerContext = createContext<PDFViewerContextType | undefined>(undefined);

/**
 * Props do Provider
 */
interface PDFViewerProviderProps {
  children: ReactNode;
}

/**
 * Provider do contexto de PDF Viewer
 */
export const PDFViewerProvider: React.FC<PDFViewerProviderProps> = ({ children }) => {
  // Estado do visualizador com largura do painel do localStorage ou padrão maximizado
  const [state, setState] = useState<PDFViewerState>(() => {
    const savedWidth = typeof window !== 'undefined' ? localStorage.getItem('pdfViewerPanelWidth') : null;

    const savedViewMode = typeof window !== 'undefined' ? (localStorage.getItem('pdfViewerViewMode') as PDFViewMode) : null;

    const savedBookmarkPanelVisible = typeof window !== 'undefined' ? localStorage.getItem('pdfBookmarkPanelVisible') : null;

    const savedBookmarkPanelWidth = typeof window !== 'undefined' ? localStorage.getItem('pdfBookmarkPanelWidth') : null;

    const savedRenderRange = typeof window !== 'undefined' ? localStorage.getItem('pdfRenderRange') : null;

    const savedSidebarVisible = typeof window !== 'undefined' ? localStorage.getItem('pdfSidebarVisible') : null;

    return {
      ...DEFAULT_STATE,
      panelWidth: savedWidth ? parseInt(savedWidth, 10) : getDefaultPanelWidth(),
      viewMode: savedViewMode || 'paginated',
      isBookmarkPanelVisible: savedBookmarkPanelVisible !== null ? savedBookmarkPanelVisible === 'true' : true,
      bookmarkPanelWidth: savedBookmarkPanelWidth ? parseInt(savedBookmarkPanelWidth, 10) : getDefaultBookmarkPanelWidth(),
      renderRange: savedRenderRange ? parseInt(savedRenderRange, 10) : 1,
      isSidebarVisible: savedSidebarVisible !== null ? savedSidebarVisible === 'true' : true,
      sidebarWidth: getDefaultSidebarWidth()
    };
  });

  // Mapa de referências dos editores
  const [editorRefs] = useState<Map<InsertionField, EditorRef>>(new Map());

  /**
   * ------------------------------------------------------------------------------------------------
   * FIX PRINCIPAL (SEARCH / HIGHLIGHT INSTÁVEL):
   * O código anterior usava setTimeout "solto" para limpar highlightedPage.
   * Se o usuário navega rápido (setas, next/prev ocorrência), timeouts antigos ainda executam e
   * acabam limpando o highlight da navegação mais recente => flicker / instabilidade.
   *
   * Solução: centralizar o agendamento de limpeza com um "token" + ref do timeout.
   * Só o último agendamento pode limpar o highlight.
   * ------------------------------------------------------------------------------------------------
   */
  const highlightClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightClearTokenRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const searchNavigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchNavigationActiveRef = useRef(false);

  const markSearchNavigationActive = useCallback((durationMs: number = 800) => {
    if (searchNavigationTimeoutRef.current) {
      clearTimeout(searchNavigationTimeoutRef.current);
    }
    isSearchNavigationActiveRef.current = true;
    searchNavigationTimeoutRef.current = setTimeout(() => {
      isSearchNavigationActiveRef.current = false;
    }, durationMs);
  }, []);

  const disableSearchNavigationSync = useCallback(() => {
    if (searchNavigationTimeoutRef.current) {
      clearTimeout(searchNavigationTimeoutRef.current);
      searchNavigationTimeoutRef.current = null;
    }
    isSearchNavigationActiveRef.current = false;
  }, []);

  const isSearchNavigationActive = useCallback(() => {
    return isSearchNavigationActiveRef.current;
  }, []);


  const findForwardSearchIndex = useCallback((results: SearchResult[], referencePage: number) => {
    const forwardIndex = results.findIndex(result => result.globalPageNumber >= referencePage);
    return forwardIndex === -1 ? results.length - 1 : forwardIndex;
  }, []);


  const cancelScheduledHighlightClear = useCallback(() => {
    if (highlightClearTimeoutRef.current) {
      clearTimeout(highlightClearTimeoutRef.current);
      highlightClearTimeoutRef.current = null;
    }
  }, []);

  const scheduleHighlightedPageClear = useCallback((delayMs: number) => {
    cancelScheduledHighlightClear();

    const token = ++highlightClearTokenRef.current;

    highlightClearTimeoutRef.current = setTimeout(() => {
      // Só o último "token" pode limpar (evita corrida com timeouts antigos)
      if (token !== highlightClearTokenRef.current) return;

      setState(prev => {
        if (prev.highlightedPage === null) return prev;
        return { ...prev, highlightedPage: null };
      });
    }, delayMs);
  }, [cancelScheduledHighlightClear]);

  /**
   * Navega para um resultado de busca específico (estável, estilo Acrobat)
   * - atualiza index
   * - navega página
   * - dispara highlightedPage (para scroll/efeito visual)
   * - agenda limpeza com token (sem corrida)
   */
  const scrollToSearchResult = useCallback((result: SearchResult) => {
    const rects = result.rects;
    const pageNumber = result.globalPageNumber;
    const pageElement =
      document.querySelector(`[data-page-number="${pageNumber}"]`) ||
      document.getElementById(`page-${pageNumber}`) ||
      document.getElementById(`pageContainer${pageNumber}`);
    const scrollContainer = scrollContainerRef.current;

    if (!pageElement) {
      return;
    }

    if (!rects || rects.length === 0) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const [rect] = rects;
    const zoom = state.zoom;

    if (scrollContainer) {
      const pageOffsetTop = (pageElement as HTMLElement).offsetTop;
      const targetTop = pageOffsetTop + rect.y * zoom;
      const desiredTop = Math.max(targetTop - 120, 0);
      if (Math.abs(scrollContainer.scrollTop - desiredTop) < 8) {
        return;
      }
      scrollContainer.scrollTo({ top: desiredTop, behavior: 'smooth' });
      return;
    }

    const pageRect = pageElement.getBoundingClientRect();
    const targetTop = pageRect.top + window.scrollY + rect.y * zoom;
    const desiredTop = Math.max(targetTop - 120, 0);
    if (Math.abs(window.scrollY - desiredTop) < 8) {
      return;
    }
    window.scrollTo({ top: desiredTop, behavior: 'smooth' });
  }, [state.zoom]);

  const navigateToSearchResultIndex = useCallback((targetIndex: number) => {
    let targetResult: SearchResult | null = null;
    let resolvedIndex = -1;
    let resolvedPage = 0;
    cancelScheduledHighlightClear();
    highlightClearTokenRef.current++;

    setState(prev => {
      const total = prev.searchResults.length;
      if (total === 0) return prev;

      const safeIndex = Math.max(0, Math.min(targetIndex, total - 1));
      const result = prev.searchResults[safeIndex];
      targetResult = result || null;
      resolvedIndex = safeIndex;
      if (!result) return { ...prev, currentSearchIndex: safeIndex };

      const validPage = Math.max(1, Math.min(result.globalPageNumber, prev.totalPages));
      resolvedPage = validPage;

      return {
        ...prev,
        currentSearchIndex: safeIndex,
        currentPage: validPage,
        highlightedPage: validPage
      };
    });

    if (targetResult && resolvedIndex >= 0 && resolvedPage > 0) {
      markSearchNavigationActive();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToSearchResult(targetResult as SearchResult);
        });
      });
    }
  }, [cancelScheduledHighlightClear, markSearchNavigationActive, scrollToSearchResult]);

  /**
   * Abre o visualizador com um ou múltiplos documentos
   */
  const openViewer = useCallback((documentsOrDocument: ProcessDocument | ProcessDocument[]) => {
    const documents = Array.isArray(documentsOrDocument) ? documentsOrDocument : [documentsOrDocument];

    logger.info(`Abrindo visualizador de PDF com ${documents.length} documento(s)`, 'PDFViewerContext.openViewer', { documentCount: documents.length });

    // Se tiver qualquer highlight pendente/timeout de highlight, cancela ao abrir
    cancelScheduledHighlightClear();
    highlightClearTokenRef.current++;

    setState(prev => ({
      ...prev,
      isOpen: true,
      documents,
      bookmarksStatusByDoc: new Map(documents.map(doc => [doc.id, 'idle' as BookmarkLoadStatus])),
      currentDocumentIndex: 0,
      currentPage: 1,
      totalPages: 0,
      selectedText: '',
      selectionPosition: null,
      isMinimized: false,
      documentPageInfo: [],
      highlightedPage: null,
      bookmarks: [],
      isLoadingBookmarks: false,
      bookmarksError: null,
      comments: [],
      highlights: [],
      // reset search (para evitar "vazar" de uma abertura anterior)
      isSearchOpen: false,
      searchQuery: '',
      searchResults: [],
      searchAnchorPage: null,
      currentSearchIndex: -1,
      isSearching: false,
      textExtractionProgress: null
    }));
  }, [cancelScheduledHighlightClear]);

  /**
   * Fecha o visualizador
   */
  const closeViewer = useCallback(() => {
    logger.info('Fechando visualizador de PDF', 'PDFViewerContext.closeViewer');

    cancelScheduledHighlightClear();
    highlightClearTokenRef.current++;

    setState(prev => ({
      ...prev,
      isOpen: false,
      documents: [],
      currentDocumentIndex: 0,
      currentPage: 1,
      totalPages: 0,
      selectedText: '',
      selectionPosition: null,
      bookmarks: [],
      bookmarksStatusByDoc: new Map(),
      isLoadingBookmarks: false,
      bookmarksError: null,
      documentPageInfo: [],
      isSearchOpen: false,
      searchQuery: '',
      searchResults: [],
      searchAnchorPage: null,
      currentSearchIndex: -1,
      isSearching: false,
      textExtractionProgress: null,
      highlightedPage: null
    }));
  }, [cancelScheduledHighlightClear]);

  /**
   * Retorna o documento atualmente ativo
   */
  const getCurrentDocument = useCallback((): ProcessDocument | null => {
    if (state.documents.length === 0) return null;
    return state.documents[state.currentDocumentIndex] || null;
  }, [state.documents, state.currentDocumentIndex]);

  /**
   * Retorna o documento que contém a página global especificada
   */
  const getDocumentByGlobalPage = useCallback(
    (globalPage: number): ProcessDocument | null => {
      if (state.documentPageInfo.length === 0) return state.documents[0] || null;

      const info = state.documentPageInfo.find(info => globalPage >= info.globalPageStart && globalPage <= info.globalPageEnd);

      return info ? state.documents[info.documentIndex] : null;
    },
    [state.documentPageInfo, state.documents]
  );

  /**
   * Converte página global para página local dentro do documento
   */
  const getLocalPageNumber = useCallback(
    (globalPage: number): number => {
      if (state.documentPageInfo.length === 0) return globalPage;

      const info = state.documentPageInfo.find(info => globalPage >= info.globalPageStart && globalPage <= info.globalPageEnd);

      if (!info) return 1;

      return globalPage - info.globalPageStart + 1;
    },
    [state.documentPageInfo]
  );

  /**
   * Converte página local de um documento para página global
   */
  const getGlobalPageNumber = useCallback(
    (documentIndex: number, localPage: number): number => {
      if (state.documentPageInfo.length === 0) return localPage;

      const info = state.documentPageInfo[documentIndex];
      if (!info) return localPage;

      return info.globalPageStart + localPage - 1;
    },
    [state.documentPageInfo]
  );

  const setDocumentPageInfo = useCallback((info: DocumentPageInfo[]) => {
    setState(prev => ({ ...prev, documentPageInfo: info }));
  }, []);

  /**
   * Alterna estado minimizado
   */
  const toggleMinimize = useCallback(() => {
    setState(prev => {
      const next = !prev.isMinimized;
      logger.info(`Visualizador ${next ? 'minimizado' : 'expandido'}`, 'PDFViewerContext.toggleMinimize');
      return { ...prev, isMinimized: next };
    });
  }, []);

  /**
   * Vai para uma página específica
   */
  const goToPage = useCallback((page: number) => {
    setState(prev => {
      const validPage = Math.max(1, Math.min(page, prev.totalPages));
      return { ...prev, currentPage: validPage };
    });
  }, []);

  /**
   * Próxima página
   */
  const nextPage = useCallback(() => {
    setState(prev => {
      if (prev.currentPage < prev.totalPages) {
        const nextPageNum = prev.currentPage + 1;
        return { ...prev, currentPage: nextPageNum, highlightedPage: nextPageNum };
      }
      return prev;
    });

    scheduleHighlightedPageClear(1000);
  }, [scheduleHighlightedPageClear]);

  /**
   * Página anterior
   */
  const previousPage = useCallback(() => {
    setState(prev => {
      if (prev.currentPage > 1) {
        const prevPageNum = prev.currentPage - 1;
        return { ...prev, currentPage: prevPageNum, highlightedPage: prevPageNum };
      }
      return prev;
    });

    scheduleHighlightedPageClear(1000);
  }, [scheduleHighlightedPageClear]);

  /**
   * Define total de páginas
   */
  const setTotalPages = useCallback((total: number) => {
    setState(prev => ({ ...prev, totalPages: total }));
  }, []);

  const zoomIn = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setState(prev => {
      const newZoom = Math.min(prev.zoom + ZOOM_STEP, ZOOM_MAX);
      return {
        ...prev,
        zoom: newZoom,
        displayZoom: newZoom,
        selectedText: '',
        selectionPosition: null
      };
    });
  }, []);

  const zoomOut = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setState(prev => {
      const newZoom = Math.max(prev.zoom - ZOOM_STEP, ZOOM_MIN);
      return {
        ...prev,
        zoom: newZoom,
        displayZoom: newZoom,
        selectedText: '',
        selectionPosition: null
      };
    });
  }, []);

  const resetZoom = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setState(prev => ({ ...prev, zoom: 1.0, displayZoom: 1.0, selectedText: '', selectionPosition: null }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    window.getSelection()?.removeAllRanges();
    const validZoom = Math.max(ZOOM_MIN, Math.min(zoom, ZOOM_MAX));
    setState(prev => ({ ...prev, zoom: validZoom, displayZoom: validZoom, selectedText: '', selectionPosition: null }));
  }, []);

  const setDisplayZoom = useCallback((zoom: number) => {
    const validZoom = Math.max(ZOOM_MIN, Math.min(zoom, ZOOM_MAX));
    setState(prev => ({ ...prev, displayZoom: validZoom }));
  }, []);

  /**
   * Define estado de interacao (scroll/zoom ativo)
   */
  const setIsInteracting = useCallback((isInteracting: boolean) => {
    setState(prev => ({ ...prev, isInteracting }));
  }, []);

  /**
   * Define texto selecionado com posição opcional
   */
  const setSelectedText = useCallback((text: string, position?: SelectionPosition) => {
    setState(prev => {
      const nextPosition = position || null;
      if (prev.selectedText === text && prev.selectionPosition === nextPosition) {
        return prev;
      }
      if (
        prev.selectedText === text &&
        prev.selectionPosition !== null &&
        nextPosition !== null &&
        prev.selectionPosition.x === nextPosition.x &&
        prev.selectionPosition.y === nextPosition.y &&
        prev.selectionPosition.width === nextPosition.width &&
        prev.selectionPosition.height === nextPosition.height &&
        prev.selectionPosition.pageNumber === nextPosition.pageNumber
      ) {
        return prev;
      }

      return {
        ...prev,
        selectedText: text,
        selectionPosition: nextPosition
      };
    });

    if (text) {
      logger.info(`Texto selecionado (${text.length} caracteres)`, 'PDFViewerContext.setSelectedText', { hasPosition: !!position });
    }
  }, []);

  /**
   * Limpa seleção de texto e posição
   */
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedText: '',
      selectionPosition: null
    }));
  }, []);

  /**
   * Define largura do painel
   */
  const setPanelWidth = useCallback((width: number) => {
    const validWidth = Math.max(600, Math.min(width, window.innerWidth - 100));
    setState(prev => ({ ...prev, panelWidth: validWidth }));

    // Salva preferência no localStorage
    try {
      localStorage.setItem('pdfViewerPanelWidth', validWidth.toString());
    } catch (error) {
      logger.warn('Erro ao salvar largura do painel', error);
    }
  }, []);

  /**
   * Define modo de visualização
   */
  const setViewMode = useCallback((mode: PDFViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));

    // Salva preferência no localStorage
    try {
      localStorage.setItem('pdfViewerViewMode', mode);
    } catch (error) {
      logger.warn('Erro ao salvar modo de visualização', error);
    }

    logger.info(`Modo de visualização alterado para: ${mode}`, 'PDFViewerContext.setViewMode');
  }, []);

  /**
   * Alterna entre modos de visualização
   */
  const toggleViewMode = useCallback(() => {
    setState(prev => {
      const newMode: PDFViewMode = prev.viewMode === 'paginated' ? 'continuous' : 'paginated';

      // Salva preferência no localStorage
      try {
        localStorage.setItem('pdfViewerViewMode', newMode);
      } catch (error) {
        logger.warn('Erro ao salvar modo de visualização', error);
      }

      logger.info(`Modo de visualização alternado para: ${newMode}`, 'PDFViewerContext.toggleViewMode');

      return { ...prev, viewMode: newMode };
    });
  }, []);

  /**
   * Navega para página com highlight temporário
   */
  const navigateToPageWithHighlight = useCallback(
    (page: number, recordId?: string) => {
      goToPage(page);

      setState(prev => ({
        ...prev,
        highlightedPage: page,
        editingRecordId: recordId || null
      }));

      scheduleHighlightedPageClear(3000);

      logger.info(`Navegando para página ${page} com highlight${recordId ? ` (record: ${recordId})` : ''}`, 'PDFViewerContext.navigateToPageWithHighlight');
    },
    [goToPage, scheduleHighlightedPageClear]
  );

  /**
   * Define aba ativa do sidebar
   */
  const setSidebarTab = useCallback((tab: SidebarTab) => {
    setState(prev => ({ ...prev, sidebarTab: tab }));
    logger.info(`Sidebar tab alterada para: ${tab}`, 'PDFViewerContext.setSidebarTab');
  }, []);

  /**
   * Define modo do formulário
   */
  const setFormMode = useCallback((mode: FormMode) => {
    setState(prev => ({ ...prev, formMode: mode }));
    logger.info(`Form mode alterado para: ${mode}`, 'PDFViewerContext.setFormMode');
  }, []);

  /**
   * Inicia criação de decisão
   */
  const startCreateDecision = useCallback(() => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'decisions',
      formMode: 'create-decision',
      editingRecordId: null
    }));

    logger.info(`Iniciando criação de decisão na página ${state.currentPage}`, 'PDFViewerContext.startCreateDecision');
  }, [state.currentPage]);

  /**
   * Inicia criação de verba
   */
  const startCreateVerba = useCallback(() => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'verbas',
      formMode: 'create-verba',
      editingRecordId: null
    }));

    logger.info(`Iniciando criação de verba na página ${state.currentPage}`, 'PDFViewerContext.startCreateVerba');
  }, [state.currentPage]);

  /**
   * Inicia edição de decisão
   */
  const startEditDecision = useCallback((decisionId: string) => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'decisions',
      formMode: 'edit-decision',
      editingRecordId: decisionId
    }));

    logger.info(`Iniciando edição de decisão: ${decisionId}`, 'PDFViewerContext.startEditDecision');
  }, []);

  /**
   * Inicia edição de verba/lançamento
   */
  const startEditVerba = useCallback((lancamentoId: string) => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'verbas',
      formMode: 'edit-verba',
      editingRecordId: lancamentoId
    }));

    logger.info(`Iniciando edição de lançamento: ${lancamentoId}`, 'PDFViewerContext.startEditVerba');
  }, []);

  /**
   * Inicia criação de documento
   */
  const startCreateDocumento = useCallback(() => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'documentos',
      formMode: 'create-documento',
      editingRecordId: null
    }));

    logger.info(`Iniciando criação de documento na página ${state.currentPage}`, 'PDFViewerContext.startCreateDocumento');
  }, [state.currentPage]);

  /**
   * Inicia edição de documento
   */
  const startEditDocumento = useCallback((documentoId: string) => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'documentos',
      formMode: 'edit-documento',
      editingRecordId: documentoId
    }));

    logger.info(`Iniciando edição de documento: ${documentoId}`, 'PDFViewerContext.startEditDocumento');
  }, []);

  /**
   * Inicia criação de lançamento de documento
   */
  const startCreateDocumentoLancamento = useCallback(() => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'documentoLancamentos',
      formMode: 'create-documento-lancamento',
      editingRecordId: null
    }));

    logger.info(`Iniciando criação de lançamento de documento na página ${state.currentPage}`, 'PDFViewerContext.startCreateDocumentoLancamento');
  }, [state.currentPage]);

  /**
   * Inicia edição de lançamento de documento
   */
  const startEditDocumentoLancamento = useCallback((documentoId: string) => {
    setState(prev => ({
      ...prev,
      sidebarTab: 'documentoLancamentos',
      formMode: 'edit-documento-lancamento',
      editingRecordId: documentoId
    }));

    logger.info(`Iniciando edição de lançamento de documento: ${documentoId}`, 'PDFViewerContext.startEditDocumentoLancamento');
  }, []);

  /**
   * Cancela formulário e volta para modo visualização
   */
  const cancelForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      formMode: 'view',
      editingRecordId: null
    }));

    logger.info('Formulário cancelado, voltando para modo view', 'PDFViewerContext.cancelForm');
  }, []);

  /**
   * Registra uma referência de editor
   */
  const registerEditor = useCallback(
    (field: InsertionField, ref: EditorRef) => {
      editorRefs.set(field, ref);

      logger.info(`Editor registrado: ${field}`, 'PDFViewerContext.registerEditor');
    },
    [editorRefs]
  );

  /**
   * Remove registro de editor
   */
  const unregisterEditor = useCallback(
    (field: InsertionField) => {
      editorRefs.delete(field);

      logger.info(`Editor removido do registro: ${field}`, 'PDFViewerContext.unregisterEditor');
    },
    [editorRefs]
  );

  /**
   * Insere texto em um campo específico
   */
  const insertTextInField = useCallback(
    (field: InsertionField, text: string): boolean => {
      const editorRef = editorRefs.get(field);

      if (!editorRef) {
        logger.warn(`Editor não encontrado para o campo: ${field}`, 'PDFViewerContext.insertTextInField');
        return false;
      }

      try {
        editorRef.insertText(text);
        editorRef.focus();

        logger.success(`Texto inserido no campo ${field} (${text.length} caracteres)`, 'PDFViewerContext.insertTextInField');

        return true;
      } catch (error) {
        logger.errorWithException(`Erro ao inserir texto no campo ${field}`, error as Error, 'PDFViewerContext.insertTextInField');
        return false;
      }
    },
    [editorRefs]
  );

  /**
   * Define bookmarks do PDF
   */
  const setBookmarks = useCallback((bookmarks: PDFBookmark[]) => {
    setState(prev => ({ ...prev, bookmarks }));
    const topLevel = bookmarks.length;
    const totalRecursive = countTotalBookmarks(bookmarks);

    logger.info(
      `Bookmarks carregados: topLevel=${topLevel}, totalRecursive=${totalRecursive}`,
      'PDFViewerContext.setBookmarks',
      { topLevel, totalRecursive }
    );
  }, []);

  const setBookmarkStatusByDoc = useCallback((documentId: string, status: BookmarkLoadStatus) => {
    setState(prev => {
      const nextStatusMap = new Map(prev.bookmarksStatusByDoc);
      nextStatusMap.set(documentId, status);
      return { ...prev, bookmarksStatusByDoc: nextStatusMap };
    });
  }, []);

  const resetBookmarksStatusByDoc = useCallback((documentIds?: string[]) => {
    setState(prev => {
      if (!documentIds || documentIds.length === 0) {
        return { ...prev, bookmarksStatusByDoc: new Map() };
      }

      const nextStatusMap = new Map<string, BookmarkLoadStatus>();
      documentIds.forEach(docId => {
        nextStatusMap.set(docId, 'idle');
      });

      return { ...prev, bookmarksStatusByDoc: nextStatusMap };
    });
  }, []);

  /**
   * Define estado de carregamento dos bookmarks
   */
  const setIsLoadingBookmarks = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoadingBookmarks: isLoading }));
  }, []);

  /**
   * Define erro ao carregar bookmarks
   */
  const setBookmarksError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, bookmarksError: error }));
    if (error) {
      logger.warn(`Erro ao carregar bookmarks: ${error}`, 'PDFViewerContext');
    }
  }, []);

  /**
   * Alterna visibilidade do painel de bookmarks
   */
  const toggleBookmarkPanel = useCallback(() => {
    setState(prev => {
      const newVisible = !prev.isBookmarkPanelVisible;

      // Salva preferência no localStorage
      try {
        localStorage.setItem('pdfBookmarkPanelVisible', newVisible.toString());
      } catch (error) {
        logger.warn('Erro ao salvar visibilidade do painel de bookmarks', error);
      }

      logger.info(`Painel de bookmarks ${newVisible ? 'exibido' : 'ocultado'}`, 'PDFViewerContext.toggleBookmarkPanel');

      return { ...prev, isBookmarkPanelVisible: newVisible };
    });
  }, []);

  /**
   * Define visibilidade do painel de bookmarks
   */
  const setBookmarkPanelVisible = useCallback((visible: boolean) => {
    setState(prev => ({ ...prev, isBookmarkPanelVisible: visible }));

    // Salva preferência no localStorage
    try {
      localStorage.setItem('pdfBookmarkPanelVisible', visible.toString());
    } catch (error) {
      logger.warn('Erro ao salvar visibilidade do painel de bookmarks', error);
    }
  }, []);

  /**
   * Define largura do painel de bookmarks
   */
  const setBookmarkPanelWidth = useCallback((width: number) => {
    const validWidth = Math.max(200, Math.min(width, 500));
    setState(prev => ({ ...prev, bookmarkPanelWidth: validWidth }));

    // Salva preferência no localStorage
    try {
      localStorage.setItem('pdfBookmarkPanelWidth', validWidth.toString());
    } catch (error) {
      logger.warn('Erro ao salvar largura do painel de bookmarks', error);
    }
  }, []);

  /**
   * Toggle visibilidade do sidebar (Decisoes/Verbas/Docs)
   */
  const toggleSidebar = useCallback(() => {
    setState(prev => {
      const newVisible = !prev.isSidebarVisible;
      try {
        localStorage.setItem('pdfSidebarVisible', newVisible.toString());
      } catch {
        // ignore
      }
      return { ...prev, isSidebarVisible: newVisible };
    });
  }, []);

  /**
   * Define visibilidade do sidebar
   */
  const setSidebarVisible = useCallback((visible: boolean) => {
    setState(prev => ({ ...prev, isSidebarVisible: visible }));
    try {
      localStorage.setItem('pdfSidebarVisible', visible.toString());
    } catch {
      // ignore
    }
  }, []);

  /**
   * Define largura do sidebar
   */
  const setSidebarWidth = useCallback((width: number) => {
    const validWidth = Math.max(280, Math.min(width, 500));
    setState(prev => ({ ...prev, sidebarWidth: validWidth }));
  }, []);

  const setComments = useCallback((comments: PDFComment[]) => {
    setState(prev => ({ ...prev, comments }));
    logger.info(`Comentários carregados: ${comments.length} items`, 'PDFViewerContext.setComments');
  }, []);

  const addComment = useCallback((comment: PDFComment) => {
    setState(prev => ({
      ...prev,
      comments: [...prev.comments, comment]
    }));
    logger.info(`Comentário adicionado na página ${comment.pageNumber}`, 'PDFViewerContext.addComment', { commentId: comment.id });
  }, []);

  const updateComment = useCallback((commentId: string, updates: Partial<PDFComment>) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => (c.id === commentId ? { ...c, ...updates } : c))
    }));
  }, []);

  const removeComment = useCallback((commentId: string) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.filter(c => c.id !== commentId),
      selectedCommentId: prev.selectedCommentId === commentId ? null : prev.selectedCommentId
    }));
    logger.info(`Comentário removido: ${commentId}`, 'PDFViewerContext.removeComment');
  }, []);

  const toggleCommentMode = useCallback(() => {
    setState(prev => {
      const newActive = !prev.isCommentModeActive;
      logger.info(`Modo comentário ${newActive ? 'ativado' : 'desativado'}`, 'PDFViewerContext.toggleCommentMode');
      return {
        ...prev,
        isCommentModeActive: newActive,
        isHighlighterActive: newActive ? false : prev.isHighlighterActive
      };
    });
  }, []);

  const setCommentModeActive = useCallback((active: boolean) => {
    setState(prev => ({
      ...prev,
      isCommentModeActive: active,
      isHighlighterActive: active ? false : prev.isHighlighterActive
    }));
  }, []);

  const selectComment = useCallback((commentId: string | null) => {
    setState(prev => ({ ...prev, selectedCommentId: commentId }));
  }, []);

  const setSelectedCommentColor = useCallback((color: CommentColor) => {
    setState(prev => ({ ...prev, selectedCommentColor: color }));
    logger.info(`Cor de comentário selecionada: ${color}`, 'PDFViewerContext.setSelectedCommentColor');
  }, []);

  const commentsByPageIndex = useMemo(() => {
    const index = new Map<number, PDFComment[]>();
    for (const c of state.comments) {
      const existing = index.get(c.pageNumber);
      if (existing) {
        existing.push(c);
      } else {
        index.set(c.pageNumber, [c]);
      }
    }
    return index;
  }, [state.comments]);

  const getCommentsByPage = useCallback(
    (pageNumber: number): PDFComment[] => {
      return commentsByPageIndex.get(pageNumber) || [];
    },
    [commentsByPageIndex]
  );

  const addConnectorToComment = useCallback((commentId: string, connector: PDFCommentConnector) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => (c.id === commentId ? { ...c, connectors: [...(c.connectors || []), connector] } : c))
    }));
    logger.info(`Conector adicionado ao comentário ${commentId}`, 'PDFViewerContext.addConnectorToComment', { connectorId: connector.id, type: connector.connectorType });
  }, []);

  const updateConnectorInComment = useCallback((commentId: string, connectorId: string, updates: Partial<PDFCommentConnector>) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c =>
        c.id === commentId
          ? {
              ...c,
              connectors: (c.connectors || []).map(conn => (conn.id === connectorId ? { ...conn, ...updates } : conn))
            }
          : c
      )
    }));
  }, []);

  const removeConnectorFromComment = useCallback((commentId: string, connectorId: string) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => (c.id === commentId ? { ...c, connectors: (c.connectors || []).filter(conn => conn.id !== connectorId) } : c))
    }));
    logger.info(`Conector removido do comentário ${commentId}`, 'PDFViewerContext.removeConnectorFromComment', { connectorId });
  }, []);

  const setDrawingConnector = useCallback((isDrawing: boolean, type: ConnectorType | null) => {
    setState(prev => ({
      ...prev,
      isDrawingConnector: isDrawing,
      drawingConnectorType: type
    }));
  }, []);

  const setEditingConnectorId = useCallback((connectorId: string | null) => {
    setState(prev => ({ ...prev, editingConnectorId: connectorId }));
  }, []);

  /**
   * Armazena dimensões de uma página específica e sua rotação interna
   */
  const setPageDimensions = useCallback((pageNumber: number, dimensions: { width: number; height: number; internalRotation?: number }) => {
    setState(prev => {
      const existingDimensions = prev.pageDimensions.get(pageNumber);
      if (
        existingDimensions &&
        existingDimensions.width === dimensions.width &&
        existingDimensions.height === dimensions.height &&
        (existingDimensions.internalRotation ?? 0) === (dimensions.internalRotation ?? 0)
      ) {
        return prev;
      }

      const newDimensions = new Map(prev.pageDimensions);
      newDimensions.set(pageNumber, dimensions);
      return { ...prev, pageDimensions: newDimensions };
    });
  }, []);

  const setPageDimensionsBatch = useCallback(
    (entries: Array<[number, { width: number; height: number; internalRotation?: number }]>) => {
      if (entries.length === 0) {
        return;
      }

      setState(prev => {
        let nextDimensions: Map<number, { width: number; height: number; internalRotation?: number }> | null = null;

        entries.forEach(([pageNumber, dimensions]) => {
          const baseMap = nextDimensions ?? prev.pageDimensions;
          const existingDimensions = baseMap.get(pageNumber);
          const hasSameDimensions =
            existingDimensions &&
            existingDimensions.width === dimensions.width &&
            existingDimensions.height === dimensions.height &&
            (existingDimensions.internalRotation ?? 0) === (dimensions.internalRotation ?? 0);

          if (hasSameDimensions) {
            return;
          }

          if (!nextDimensions) {
            nextDimensions = new Map(prev.pageDimensions);
          }

          nextDimensions.set(pageNumber, dimensions);
        });

        if (!nextDimensions) {
          return prev;
        }

        return { ...prev, pageDimensions: nextDimensions };
      });
    },
    []
  );

  const registerScrollContainer = useCallback((container: HTMLDivElement | null) => {
    scrollContainerRef.current = container;
  }, []);

  const getPageHeight = useCallback(
    (pageNumber: number): number => {
      const dimensions = state.pageDimensions.get(pageNumber);
      const rotation = state.pageRotations[pageNumber] || 0;
      const isRotated90or270 = rotation === 90 || rotation === 270;

      if (dimensions) {
        const effectiveHeight = isRotated90or270 ? dimensions.width : dimensions.height;
        return effectiveHeight * state.zoom;
      }
      const fallbackHeight = isRotated90or270 ? 595 : 842;
      return fallbackHeight * state.zoom;
    },
    [state.pageDimensions, state.zoom, state.pageRotations]
  );

  const getPageWidth = useCallback(
    (pageNumber: number): number => {
      const dimensions = state.pageDimensions.get(pageNumber);
      const rotation = state.pageRotations[pageNumber] || 0;
      const isRotated90or270 = rotation === 90 || rotation === 270;

      if (dimensions) {
        const effectiveWidth = isRotated90or270 ? dimensions.height : dimensions.width;
        return effectiveWidth * state.zoom;
      }
      const fallbackWidth = isRotated90or270 ? 842 : 595;
      return fallbackWidth * state.zoom;
    },
    [state.pageDimensions, state.zoom, state.pageRotations]
  );

  const cumulativePageTops = useMemo(() => {
    const tops: number[] = [];
    let accumulatedHeight = 0;

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      tops.push(accumulatedHeight);
      accumulatedHeight += getPageHeight(pageNum) + CONTINUOUS_PAGE_GAP_PX;
    }

    return tops;
  }, [getPageHeight, state.totalPages]);

  const cumulativePageBottoms = useMemo(() => {
    return cumulativePageTops.map((top, index) => top + getPageHeight(index + 1));
  }, [cumulativePageTops, getPageHeight]);

  const getVisiblePageFromScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || state.viewMode !== 'continuous' || state.totalPages === 0) {
      return null;
    }

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const viewportCenter = scrollTop + viewportHeight / 2;
    let centerPage = 1;
    let minDistanceToCenter = Infinity;

    const visibleStartIndex = Math.max(0, findFirstIndexByBottom(cumulativePageBottoms, scrollTop));
    const visibleEndIndex = Math.min(
      cumulativePageTops.length - 1,
      findLastIndexByTop(cumulativePageTops, scrollTop + viewportHeight)
    );

    if (visibleStartIndex <= visibleEndIndex) {
      for (let pageIndex = visibleStartIndex; pageIndex <= visibleEndIndex; pageIndex++) {
        const pageTop = cumulativePageTops[pageIndex];
        const pageBottom = cumulativePageBottoms[pageIndex];
        const pageCenter = pageTop + (pageBottom - pageTop) / 2;
        const distanceToCenter = Math.abs(pageCenter - viewportCenter);

        if (distanceToCenter < minDistanceToCenter) {
          minDistanceToCenter = distanceToCenter;
          centerPage = pageIndex + 1;
        }
      }
    } else {
      const centerIndex = findFirstIndexByBottom(cumulativePageBottoms, viewportCenter);
      centerPage = Math.min(
        state.totalPages,
        Math.max(1, centerIndex >= state.totalPages ? state.totalPages : centerIndex + 1)
      );
    }

    return centerPage;
  }, [cumulativePageBottoms, cumulativePageTops, state.totalPages, state.viewMode]);

  /**
   * Define o range de páginas a serem renderizadas
   */
  const setRenderRange = useCallback((range: number) => {
    const validRange = Math.max(1, Math.min(range, 10));
    setState(prev => ({ ...prev, renderRange: validRange }));

    try {
      localStorage.setItem('pdfRenderRange', validRange.toString());
    } catch (error) {
      logger.warn('Erro ao salvar range de renderização', error);
    }
  }, []);

  /**
   * Retorna o renderRange efetivo baseado no modo de visualização e performance
   */
  const getEffectiveRenderRange = useCallback((): number => {
    if (state.viewMode === 'continuous') {
      if (state.performanceMode.enabled) {
        return 1;
      }
      return Math.max(2, state.renderRange);
    }
    return 0;
  }, [state.viewMode, state.renderRange, state.performanceMode.enabled]);

  /**
   * Define todos os highlights
   */
  const setHighlights = useCallback((highlights: PDFHighlight[]) => {
    setState(prev => ({ ...prev, highlights }));
    logger.info(`Highlights carregados: ${highlights.length} items`, 'PDFViewerContext.setHighlights');
  }, []);

  /**
   * Adiciona um novo highlight
   */
  const addHighlight = useCallback((highlight: PDFHighlight) => {
    setState(prev => ({
      ...prev,
      highlights: [...prev.highlights, highlight]
    }));
    logger.info(`Highlight adicionado na página ${highlight.pageNumber}`, 'PDFViewerContext.addHighlight', { highlightId: highlight.id, color: highlight.color });
  }, []);

  /**
   * Remove um highlight
   */
  const removeHighlight = useCallback((highlightId: string) => {
    setState(prev => ({
      ...prev,
      highlights: prev.highlights.filter(h => h.id !== highlightId)
    }));
    logger.info(`Highlight removido: ${highlightId}`, 'PDFViewerContext.removeHighlight');
  }, []);

  /**
   * Atualiza a cor de um highlight
   */
  const updateHighlightColor = useCallback((highlightId: string, color: HighlightColor) => {
    setState(prev => ({
      ...prev,
      highlights: prev.highlights.map(h => (h.id === highlightId ? { ...h, color } : h))
    }));
    logger.info(`Cor do highlight atualizada: ${highlightId} -> ${color}`, 'PDFViewerContext.updateHighlightColor');
  }, []);

  /**
   * Alterna modo highlighter
   */
  const toggleHighlighter = useCallback(() => {
    setState(prev => {
      const newActive = !prev.isHighlighterActive;
      logger.info(`Modo highlighter ${newActive ? 'ativado' : 'desativado'}`, 'PDFViewerContext.toggleHighlighter');
      return { ...prev, isHighlighterActive: newActive };
    });
  }, []);

  /**
   * Define se o highlighter está ativo
   */
  const setHighlighterActive = useCallback((active: boolean) => {
    setState(prev => ({ ...prev, isHighlighterActive: active }));
  }, []);

  /**
   * Define a cor selecionada para highlight
   */
  const setSelectedHighlightColor = useCallback((color: HighlightColor) => {
    setState(prev => ({ ...prev, selectedHighlightColor: color }));
    logger.info(`Cor de highlight selecionada: ${color}`, 'PDFViewerContext.setSelectedHighlightColor');
  }, []);

  /**
   * Define o highlight que está sendo hover
   */
  const setHoveredHighlightId = useCallback((highlightId: string | null) => {
    setState(prev => ({ ...prev, hoveredHighlightId: highlightId }));
  }, []);

  const highlightsByPageIndex = useMemo(() => {
    const index = new Map<number, PDFHighlight[]>();
    for (const h of state.highlights) {
      const existing = index.get(h.pageNumber);
      if (existing) {
        existing.push(h);
      } else {
        index.set(h.pageNumber, [h]);
      }
    }
    return index;
  }, [state.highlights]);

  const getHighlightsByPage = useCallback(
    (pageNumber: number): PDFHighlight[] => {
      return highlightsByPageIndex.get(pageNumber) || [];
    },
    [highlightsByPageIndex]
  );

  /**
   * Define os highlights selecionados (para destaque visual de múltiplos)
   */
  const setSelectedHighlightIds = useCallback((highlightIds: string[]) => {
    setState(prev => ({ ...prev, selectedHighlightIds: highlightIds }));
    logger.info(`Highlights selecionados: ${highlightIds.length > 0 ? highlightIds.join(', ') : 'none'}`, 'PDFViewerContext.setSelectedHighlightIds');
  }, []);

  /**
   * Adiciona um highlight ID para vincular ao próximo lançamento (acumula)
   */
  const addHighlightIdToLink = useCallback((highlightId: string) => {
    setState(prev => ({
      ...prev,
      highlightIdsToLink: [...prev.highlightIdsToLink, highlightId]
    }));
    logger.info(`Highlight ID adicionado para vincular: ${highlightId}`, 'PDFViewerContext.addHighlightIdToLink');
  }, []);

  /**
   * Limpa todos os highlight IDs para vincular
   */
  const clearHighlightIdsToLink = useCallback(() => {
    setState(prev => ({ ...prev, highlightIdsToLink: [] }));
    logger.info('Highlight IDs para vincular limpos', 'PDFViewerContext.clearHighlightIdsToLink');
  }, []);

  /**
   * Navega até múltiplos highlights com scroll automático e destaque visual
   */
  const scrollToMultipleHighlights = useCallback(
    (highlightIds: string[], pageNumber?: number) => {
      if (highlightIds.length === 0) {
        logger.warn(
          'Nenhum highlight ID fornecido para navegação',
          'PDFViewerContext.scrollToMultipleHighlights'
        );
        if (pageNumber) {
          logger.info(`Fallback: navegando diretamente para página ${pageNumber}`, 'PDFViewerContext.scrollToMultipleHighlights');
          setState(prev => ({
            ...prev,
            currentPage: pageNumber,
            highlightedPage: pageNumber
          }));
          scheduleHighlightedPageClear(1000);
        }
        return;
      }

      const relevantHighlights = state.highlights.filter(h => highlightIds.includes(h.id));

      if (relevantHighlights.length === 0) {
        logger.warn(
          'Nenhum highlight encontrado para os IDs fornecidos',
          'PDFViewerContext.scrollToMultipleHighlights'
        );
        if (pageNumber) {
          logger.info(`Fallback: navegando diretamente para página ${pageNumber}`, 'PDFViewerContext.scrollToMultipleHighlights');
          setState(prev => ({
            ...prev,
            currentPage: pageNumber,
            highlightedPage: pageNumber
          }));
          scheduleHighlightedPageClear(1000);
        }
        return;
      }

      const highlightsByPage = new Map<number, string[]>();
      relevantHighlights.forEach(h => {
        const pageHighlights = highlightsByPage.get(h.pageNumber) || [];
        pageHighlights.push(h.id);
        highlightsByPage.set(h.pageNumber, pageHighlights);
      });

      const sortedPages = Array.from(highlightsByPage.keys()).sort((a, b) => a - b);

      logger.info(`Navegando para ${highlightIds.length} highlights em ${sortedPages.length} página(s)`, 'PDFViewerContext.scrollToMultipleHighlights', {
        highlightIds,
        pages: sortedPages
      });

      const PAGE_RENDER_DELAY = 500;
      const HIGHLIGHT_BLINK_TIME = 2500;

      const navigateToPageIndex = (pageIndex: number) => {
        if (pageIndex >= sortedPages.length) {
          setState(prev => ({
            ...prev,
            selectedHighlightIds: [],
            highlightedPage: null
          }));
          logger.success('Navegação sequencial de highlights concluída', 'PDFViewerContext.scrollToMultipleHighlights');
          return;
        }

        const targetPage = sortedPages[pageIndex];
        const pageHighlightIds = highlightsByPage.get(targetPage) || [];

        logger.info(`Navegando para página ${targetPage} (${pageIndex + 1}/${sortedPages.length})`, 'PDFViewerContext.scrollToMultipleHighlights', {
          pageHighlightIds
        });

        setState(prev => ({
          ...prev,
          currentPage: targetPage,
          highlightedPage: targetPage,
          selectedHighlightIds: []
        }));

        // não usar scheduleHighlightedPageClear aqui porque o "blink" controla
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            selectedHighlightIds: pageHighlightIds
          }));

          setTimeout(() => {
            const firstHighlightOnPage = pageHighlightIds[0];
            const highlightElement = document.getElementById(`highlight-${firstHighlightOnPage}`);
            if (highlightElement) {
              highlightElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
              logger.info(`Scroll para highlight ${firstHighlightOnPage} na página ${targetPage}`, 'PDFViewerContext.scrollToMultipleHighlights');
            }
          }, 200);

          setTimeout(() => {
            navigateToPageIndex(pageIndex + 1);
          }, HIGHLIGHT_BLINK_TIME);
        }, PAGE_RENDER_DELAY);
      };

      navigateToPageIndex(0);
    },
    [state.highlights, scheduleHighlightedPageClear]
  );

  const openSearch = useCallback(() => {
    setState(prev => ({ ...prev, isSearchOpen: true }));
    logger.info('Search panel opened', 'PDFViewerContext.openSearch');
  }, []);

  const closeSearch = useCallback(() => {
    // Cancela highlight pendente para não "piscar" ao fechar
    cancelScheduledHighlightClear();
    highlightClearTokenRef.current++;

    setState(prev => ({
      ...prev,
      isSearchOpen: false,
      searchQuery: '',
      searchResults: [],
      searchAnchorPage: null,
      currentSearchIndex: -1,
      isSearching: false,
      highlightedPage: null
    }));
    logger.info('Search panel closed', 'PDFViewerContext.closeSearch');
  }, [cancelScheduledHighlightClear]);

  const toggleSearch = useCallback(() => {
    setState(prev => {
      const newIsOpen = !prev.isSearchOpen;
      if (!newIsOpen) {
        // Ao fechar, também limpa highlight de busca
        cancelScheduledHighlightClear();
        highlightClearTokenRef.current++;
        return {
          ...prev,
          isSearchOpen: false,
          searchQuery: '',
          searchResults: [],
          searchAnchorPage: null,
          currentSearchIndex: -1,
          isSearching: false,
          highlightedPage: null
        };
      }
      return { ...prev, isSearchOpen: true };
    });
  }, [cancelScheduledHighlightClear]);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setSearchAnchorPage = useCallback((page: number | null) => {
    setState(prev => ({ ...prev, searchAnchorPage: page }));
  }, []);

  /**
   * Ajuste: ao definir resultados:
   * - index = 0
   * - navega para a primeira ocorrência (com highlightedPage estável)
   */
  const setSearchResults = useCallback(
    (results: SearchResult[]) => {
      cancelScheduledHighlightClear();
      highlightClearTokenRef.current++;
      const visiblePage = getVisiblePageFromScroll();

      setState(prev => {
        if (results.length === 0) {
          return {
            ...prev,
            searchResults: [],
            searchAnchorPage: null,
            currentSearchIndex: -1,
            isSearching: false,
            highlightedPage: null
          };
        }

        const referencePage = prev.searchAnchorPage ?? visiblePage ?? prev.currentPage;
        const exactMatchIndex = results.findIndex(result => result.globalPageNumber === referencePage);
        const safeIndex = exactMatchIndex !== -1
          ? exactMatchIndex
          : findForwardSearchIndex(results, referencePage);
        const hasMatchOnCurrentPage = exactMatchIndex !== -1;
        const nextHighlightedPage = hasMatchOnCurrentPage
          ? referencePage
          : results[safeIndex]?.globalPageNumber ?? prev.highlightedPage;
        
        return {
          ...prev,
          searchResults: results,
          searchAnchorPage: null,
          currentSearchIndex: safeIndex,
          isSearching: false,
          highlightedPage: nextHighlightedPage
        };

      });
    },
    [cancelScheduledHighlightClear, findForwardSearchIndex, getVisiblePageFromScroll]
  );


  const setCurrentSearchIndex = useCallback(
    (index: number) => {
      // Em vez de só setar index, navega de forma estável
      navigateToSearchResultIndex(index);
    },
    [navigateToSearchResultIndex]
  );

  const goToNextSearchResult = useCallback(() => {
    const total = state.searchResults.length;
    if (total === 0) return;

    const current = state.currentSearchIndex < 0 ? 0 : state.currentSearchIndex;
    const nextIndex = (current + 1) % total;
    navigateToSearchResultIndex(nextIndex);
  }, [state.searchResults.length, state.currentSearchIndex, navigateToSearchResultIndex]);

  const goToPreviousSearchResult = useCallback(() => {
    const total = state.searchResults.length;
    if (total === 0) return;

    const current = state.currentSearchIndex < 0 ? 0 : state.currentSearchIndex;
    const prevIndex = current <= 0 ? total - 1 : current - 1;
    navigateToSearchResultIndex(prevIndex);
  }, [state.searchResults.length, state.currentSearchIndex, navigateToSearchResultIndex]);

  const setIsSearching = useCallback((isSearching: boolean) => {
    setState(prev => ({ ...prev, isSearching }));
  }, []);

  const setTextExtractionProgress = useCallback((progress: { current: number; total: number } | null) => {
    setState(prev => ({ ...prev, textExtractionProgress: progress }));
  }, []);

  const clearSearch = useCallback(() => {
    cancelScheduledHighlightClear();
    highlightClearTokenRef.current++;

    setState(prev => ({
      ...prev,
      searchQuery: '',
      searchResults: [],
      searchAnchorPage: null,
      currentSearchIndex: -1,
      isSearching: false,
      highlightedPage: null
    }));
    logger.info('Search cleared', 'PDFViewerContext.clearSearch');
  }, [cancelScheduledHighlightClear]);

  const pendingRotationSaves = useRef<Map<number, number>>(new Map());
  const rotationSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationBlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ROTATION_SAVE_DEBOUNCE_MS = 500;
  const ROTATION_BLOCK_DURATION_MS = 800;

  const flushPendingRotationSaves = useCallback(async () => {
    const currentDoc = state.documents[state.currentDocumentIndex];
    if (!currentDoc || pendingRotationSaves.current.size === 0) return;

    const toSave = Array.from(pendingRotationSaves.current.entries()).map(([pageNumber, rotationDegrees]) => ({
      pageNumber,
      rotationDegrees
    }));
    pendingRotationSaves.current.clear();

    try {
      await PageRotationService.upsertPageRotations(currentDoc.id, toSave);
      logger.info(`Saved ${toSave.length} page rotation(s)`, 'PDFViewerContext.flushPendingRotationSaves');
    } catch (error) {
      logger.errorWithException('Failed to save page rotations', error as Error, 'PDFViewerContext.flushPendingRotationSaves');
    }
  }, [state.documents, state.currentDocumentIndex]);

  const scheduleRotationSave = useCallback(
    (pageNumber: number, degrees: number) => {
      pendingRotationSaves.current.set(pageNumber, degrees);

      if (rotationSaveTimeoutRef.current) {
        clearTimeout(rotationSaveTimeoutRef.current);
      }

      rotationSaveTimeoutRef.current = setTimeout(() => {
        flushPendingRotationSaves();
      }, ROTATION_SAVE_DEBOUNCE_MS);
    },
    [flushPendingRotationSaves]
  );

  useEffect(() => {
    const currentDoc = state.documents[state.currentDocumentIndex];
    if (!currentDoc) {
      setState(prev => ({ ...prev, pageRotations: {}, isLoadingRotations: false }));
      return;
    }

    const loadRotations = async () => {
      setState(prev => ({ ...prev, isLoadingRotations: true }));
      try {
        const loadedRotations = await PageRotationService.getPageRotations(currentDoc.id);
        setState(prev => ({ ...prev, pageRotations: loadedRotations, isLoadingRotations: false }));
        logger.info(`Loaded ${Object.keys(loadedRotations).length} page rotations for document`, 'PDFViewerContext.loadRotations');
      } catch (error) {
        logger.errorWithException('Failed to load page rotations', error as Error, 'PDFViewerContext.loadRotations');
        setState(prev => ({ ...prev, isLoadingRotations: false }));
      }
    };

    loadRotations();
  }, [state.documents, state.currentDocumentIndex]);

  useEffect(() => {
    return () => {
      // cleanup de timeouts
      if (searchNavigationTimeoutRef.current) clearTimeout(searchNavigationTimeoutRef.current);
      if (rotationSaveTimeoutRef.current) clearTimeout(rotationSaveTimeoutRef.current);
      if (rotationBlockTimeoutRef.current) clearTimeout(rotationBlockTimeoutRef.current);
      if (highlightClearTimeoutRef.current) clearTimeout(highlightClearTimeoutRef.current);
    };
  }, []);

  const getPageRotation = useCallback(
    (pageNumber: number): number => {
      return state.pageRotations[pageNumber] || 0;
    },
    [state.pageRotations]
  );

  const clearRotationBlock = useCallback(() => {
    if (rotationBlockTimeoutRef.current) {
      clearTimeout(rotationBlockTimeoutRef.current);
    }
    rotationBlockTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isRotating: false,
        rotationTargetPage: null
      }));
    }, ROTATION_BLOCK_DURATION_MS);
  }, []);

  const rotatePage = useCallback(
    (pageNumber: number, degrees: number) => {
      const normalizedDegrees = ((degrees % 360) + 360) % 360;

      setState(prev => {
        const newRotations = { ...prev.pageRotations };
        if (normalizedDegrees === 0) {
          delete newRotations[pageNumber];
        } else {
          newRotations[pageNumber] = normalizedDegrees;
        }
        return {
          ...prev,
          pageRotations: newRotations,
          currentPage: pageNumber,
          isRotating: true,
          rotationTargetPage: pageNumber
        };
      });

      clearRotationBlock();
      scheduleRotationSave(pageNumber, normalizedDegrees);
    },
    [scheduleRotationSave, clearRotationBlock]
  );

  const rotatePageBy = useCallback(
    (pageNumber: number, delta: number) => {
      const currentRotation = state.pageRotations[pageNumber] || 0;
      const newRotation = ((currentRotation + delta) % 360 + 360) % 360;
      rotatePage(pageNumber, newRotation);
    },
    [state.pageRotations, rotatePage]
  );

  const rotatePages = useCallback(
    (pageNumbers: number[], degrees: number) => {
      const normalizedDegrees = ((degrees % 360) + 360) % 360;
      const targetPage = pageNumbers.length > 0 ? pageNumbers[0] : null;

      setState(prev => {
        const newRotations = { ...prev.pageRotations };
        pageNumbers.forEach(pageNumber => {
          if (normalizedDegrees === 0) {
            delete newRotations[pageNumber];
          } else {
            newRotations[pageNumber] = normalizedDegrees;
          }
          pendingRotationSaves.current.set(pageNumber, normalizedDegrees);
        });
        return {
          ...prev,
          pageRotations: newRotations,
          currentPage: targetPage ?? prev.currentPage,
          isRotating: true,
          rotationTargetPage: targetPage
        };
      });

      clearRotationBlock();

      if (rotationSaveTimeoutRef.current) {
        clearTimeout(rotationSaveTimeoutRef.current);
      }

      rotationSaveTimeoutRef.current = setTimeout(() => {
        flushPendingRotationSaves();
      }, ROTATION_SAVE_DEBOUNCE_MS);
    },
    [flushPendingRotationSaves, clearRotationBlock]
  );

  const rotatePagesBy = useCallback(
    (pageNumbers: number[], delta: number) => {
      const targetPage = pageNumbers.length > 0 ? pageNumbers[0] : null;

      setState(prev => {
        const newRotations = { ...prev.pageRotations };
        pageNumbers.forEach(pageNumber => {
          const currentRotation = prev.pageRotations[pageNumber] || 0;
          const newRotation = ((currentRotation + delta) % 360 + 360) % 360;
          if (newRotation === 0) {
            delete newRotations[pageNumber];
          } else {
            newRotations[pageNumber] = newRotation;
          }
          pendingRotationSaves.current.set(pageNumber, newRotation);
        });
        return {
          ...prev,
          pageRotations: newRotations,
          currentPage: targetPage ?? prev.currentPage,
          isRotating: true,
          rotationTargetPage: targetPage
        };
      });

      clearRotationBlock();

      if (rotationSaveTimeoutRef.current) {
        clearTimeout(rotationSaveTimeoutRef.current);
      }

      rotationSaveTimeoutRef.current = setTimeout(() => {
        flushPendingRotationSaves();
      }, ROTATION_SAVE_DEBOUNCE_MS);
    },
    [flushPendingRotationSaves, clearRotationBlock]
  );

  const resetPageRotation = useCallback(
    (pageNumber: number) => {
      rotatePage(pageNumber, 0);
    },
    [rotatePage]
  );

  const resetAllRotations = useCallback(async () => {
    const currentDoc = state.documents[state.currentDocumentIndex];
    if (!currentDoc) return;

    setState(prev => ({
      ...prev,
      pageRotations: {},
      isRotating: true,
      rotationTargetPage: prev.currentPage
    }));
    pendingRotationSaves.current.clear();

    clearRotationBlock();

    if (rotationSaveTimeoutRef.current) {
      clearTimeout(rotationSaveTimeoutRef.current);
    }

    try {
      await PageRotationService.deleteAllPageRotations(currentDoc.id);
      logger.info('All page rotations reset', 'PDFViewerContext.resetAllRotations');
    } catch (error) {
      logger.errorWithException('Failed to reset all page rotations', error as Error, 'PDFViewerContext.resetAllRotations');
    }
  }, [state.documents, state.currentDocumentIndex, clearRotationBlock]);

  const openRotationModal = useCallback(() => {
    setState(prev => ({ ...prev, isRotationModalOpen: true }));
  }, []);

  const closeRotationModal = useCallback(() => {
    setState(prev => ({ ...prev, isRotationModalOpen: false }));
  }, []);

  const openPageExtractionModal = useCallback(() => {
    setState(prev => ({ ...prev, isPageExtractionModalOpen: true }));
    logger.info('Page extraction modal opened', 'PDFViewerContext.openPageExtractionModal');
  }, []);

  const closePageExtractionModal = useCallback(() => {
    setState(prev => ({ ...prev, isPageExtractionModalOpen: false }));
    logger.info('Page extraction modal closed', 'PDFViewerContext.closePageExtractionModal');
  }, []);

  const hasRotations = Object.keys(state.pageRotations).length > 0;
  const rotatedPageCount = Object.keys(state.pageRotations).length;

  const value = useMemo<PDFViewerContextType>(() => ({
    state,
    openViewer,
    closeViewer,
    toggleMinimize,
    getCurrentDocument,
    getDocumentByGlobalPage,
    getLocalPageNumber,
    getGlobalPageNumber,
    setDocumentPageInfo,
    goToPage,
    nextPage,
    previousPage,
    setTotalPages,
    navigateToPageWithHighlight,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    setDisplayZoom,
    setIsInteracting,
    setSelectedText,
    clearSelection,
    setPanelWidth,
    setViewMode,
    toggleViewMode,
    setSidebarTab,
    setFormMode,
    startCreateDecision,
    startCreateVerba,
    startCreateDocumento,
    startCreateDocumentoLancamento,
    startEditDecision,
    startEditVerba,
    startEditDocumento,
    startEditDocumentoLancamento,
    cancelForm,
    registerEditor,
    unregisterEditor,
    insertTextInField,
    setBookmarks,
    setBookmarkStatusByDoc,
    resetBookmarksStatusByDoc,
    setIsLoadingBookmarks,
    setBookmarksError,
    toggleBookmarkPanel,
    setBookmarkPanelVisible,
    setBookmarkPanelWidth,
    setPageDimensions,
    setPageDimensionsBatch,
    getPageHeight,
    getPageWidth,
    setRenderRange,
    getEffectiveRenderRange,
    registerScrollContainer,
    getVisiblePageFromScroll,
    setHighlights,
    addHighlight,
    removeHighlight,
    updateHighlightColor,
    toggleHighlighter,
    setHighlighterActive,
    setSelectedHighlightColor,
    setHoveredHighlightId,
    getHighlightsByPage,
    setSelectedHighlightIds,
    addHighlightIdToLink,
    clearHighlightIdsToLink,
    scrollToMultipleHighlights,
    openSearch,
    closeSearch,
    toggleSearch,
    setSearchQuery,
    setSearchAnchorPage,
    setSearchResults,
    setCurrentSearchIndex,
    goToNextSearchResult,
    goToPreviousSearchResult,
    setIsSearching,
    disableSearchNavigationSync,
    isSearchNavigationActive,
    setTextExtractionProgress,
    clearSearch,
    getPageRotation,
    rotatePage,
    rotatePageBy,
    rotatePages,
    rotatePagesBy,
    resetPageRotation,
    resetAllRotations,
    openRotationModal,
    closeRotationModal,
    hasRotations,
    rotatedPageCount,
    openPageExtractionModal,
    closePageExtractionModal,
    toggleSidebar,
    setSidebarVisible,
    setSidebarWidth,
    setComments,
    addComment,
    updateComment,
    removeComment,
    toggleCommentMode,
    setCommentModeActive,
    selectComment,
    setSelectedCommentColor,
    getCommentsByPage,
    addConnectorToComment,
    updateConnectorInComment,
    removeConnectorFromComment,
    setDrawingConnector,
    setEditingConnectorId
  }), [
    state, hasRotations, rotatedPageCount,
    openViewer, closeViewer, toggleMinimize,
    getCurrentDocument, getDocumentByGlobalPage, getLocalPageNumber, getGlobalPageNumber, setDocumentPageInfo,
    goToPage, nextPage, previousPage, setTotalPages, navigateToPageWithHighlight,
    zoomIn, zoomOut, resetZoom, setZoom, setDisplayZoom, setIsInteracting,
    setSelectedText, clearSelection, setPanelWidth, setViewMode, toggleViewMode,
    setSidebarTab, setFormMode, startCreateDecision, startCreateVerba, startCreateDocumento, startCreateDocumentoLancamento,
    startEditDecision, startEditVerba, startEditDocumento, startEditDocumentoLancamento, cancelForm,
    registerEditor, unregisterEditor, insertTextInField,
    setBookmarks, setBookmarkStatusByDoc, resetBookmarksStatusByDoc, setIsLoadingBookmarks, setBookmarksError, toggleBookmarkPanel, setBookmarkPanelVisible, setBookmarkPanelWidth,
    setPageDimensions, setPageDimensionsBatch, getPageHeight, getPageWidth, setRenderRange, getEffectiveRenderRange, registerScrollContainer, getVisiblePageFromScroll,
    setHighlights, addHighlight, removeHighlight, updateHighlightColor,
    toggleHighlighter, setHighlighterActive, setSelectedHighlightColor, setHoveredHighlightId,
    getHighlightsByPage, setSelectedHighlightIds, addHighlightIdToLink, clearHighlightIdsToLink, scrollToMultipleHighlights,
    openSearch, closeSearch, toggleSearch, setSearchQuery, setSearchAnchorPage, setSearchResults,
    setCurrentSearchIndex, goToNextSearchResult, goToPreviousSearchResult, setIsSearching,
    disableSearchNavigationSync, isSearchNavigationActive, setTextExtractionProgress, clearSearch,
    getPageRotation, rotatePage, rotatePageBy, rotatePages, rotatePagesBy, resetPageRotation, resetAllRotations,
    openRotationModal, closeRotationModal, openPageExtractionModal, closePageExtractionModal,
    toggleSidebar, setSidebarVisible, setSidebarWidth,
    setComments, addComment, updateComment, removeComment, toggleCommentMode, setCommentModeActive,
    selectComment, setSelectedCommentColor, getCommentsByPage,
    addConnectorToComment, updateConnectorInComment, removeConnectorFromComment, setDrawingConnector, setEditingConnectorId
  ]);

  return <PDFViewerContext.Provider value={value}>{children}</PDFViewerContext.Provider>;
};

/**
 * Hook para usar o contexto do PDF Viewer
 */
export const usePDFViewer = (): PDFViewerContextType => {
  const context = useContext(PDFViewerContext);

  if (!context) {
    throw new Error('usePDFViewer must be used within PDFViewerProvider');
  }

  return context;
};

export default PDFViewerContext;
