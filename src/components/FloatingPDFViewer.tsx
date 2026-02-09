/**
 * Componente FloatingPDFViewer - Visualizador de PDF flutuante
 *
 * Funcionalidades:
 * - Renderização de PDF com react-pdf
 * - Navegação entre páginas
 * - Controles de zoom
 * - Seleção de texto
 * - Inserção de texto em campos Fundamentação e Comentários Calculistas
 * - Painel flutuante redimensionável
 * - Estados minimizado e expandido
 *
 * Otimizações de Performance V4 (Modo Contínuo Rápido):
 * - RENDERIZAÇÃO EXPANDIDA: página atual ± 2 vizinhas (total 5 páginas)
 * - PRELOAD IMEDIATO: páginas +-2 carregadas instantaneamente (sem esperar idle)
 * - IDLE PRELOAD SECUNDÁRIO: páginas +-3,+-4 via requestIdleCallback
 * - CACHE DE VISITADAS: últimas 10 páginas mantidas em memória para navegação rápida
 * - FALLBACK DE RENDER: timeout de 500ms garante página atual sempre renderizada
 * - IntersectionObserver com rootMargin expandido (200px) para detecção antecipada
 * - Threshold 0.3 e hysteresis 50ms para resposta mais rápida
 * - Debounce reduzido para 100ms (mais responsivo)
 * - Virtualização eficiente: placeholders leves para páginas não renderizadas
 * - Scroll programático com flag para evitar conflitos de detecção
 * - Performance otimizada para modo contínuo
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Document, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { usePDFViewer, InsertionField } from '../contexts/PDFViewerContext';
import { useToast } from '../contexts/ToastContext';
import { Columns2 as Columns, FileText, BookOpen, Highlighter, Search, FileOutput, PanelRightClose, PanelRight, MoreVertical, ChevronDown, MessageCircle } from 'lucide-react';
import { useResponsivePanel } from '../hooks';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_CONFIG } from '../types/Highlight';
import { PDFSidebar, PDFBookmarkPanel, TextSelectionPopup, HighlightLayer, SelectionOverlay, PDFSearchPopup, PDFSearchHighlightLayer, RotationControls, PageRangeRotationModal, MemoizedPDFPage, PageExtractionModal, CommentLayer } from './pdf';
import { COMMENT_COLORS, CommentColor } from '../types/PDFComment';
import * as PDFCommentsService from '../services/pdfComments.service';
import { useSelectionOverlay } from '../hooks/useSelectionOverlay';
import logger from '../utils/logger';
import { formatPDFText, extractTextFromSelection } from '../utils/textFormatter';
import * as HighlightsService from '../services/highlights.service';
import { extractAllPagesText } from '../utils/pdfTextExtractor';
import {
  generatePDFCacheKey,
  saveBookmarksToCache,
  loadBookmarksFromCache,
  clearOldBookmarkCaches
} from '../utils/performance';
import { extractBookmarksWithDocumentInfo, mergeBookmarksFromMultipleDocuments, DocumentInfo } from '../utils/pdfBookmarkExtractor';
import { mergeRectsIntoLines } from '../utils/rectMerger';

// Configurar worker do PDF.js usando arquivo local
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const PDF_DEBUG = false;

interface FloatingPDFViewerProps {
  processId?: string;
}

const FloatingPDFViewer: React.FC<FloatingPDFViewerProps> = ({
  processId = ''
}) => {
  const {
    state,
    closeViewer,
    toggleMinimize,
    nextPage,
    previousPage,
    goToPage,
    setTotalPages,
    zoomIn,
    zoomOut,
    resetZoom,
    setDisplayZoom,
    setIsInteracting,
    setSelectedText,
    clearSelection,
    setPanelWidth,
    insertTextInField,
    toggleViewMode,
    setBookmarks,
    setIsLoadingBookmarks,
    setBookmarksError,
    toggleBookmarkPanel,
    setPageDimensions,
    getPageHeight,
    getPageWidth,
    getCurrentDocument,
    getDocumentByGlobalPage,
    setDocumentPageInfo,
    toggleHighlighter,
    setSelectedHighlightColor,
    addHighlight,
    setHighlights,
    addHighlightIdToLink,
    toggleSearch,
    getPageRotation,
    openPageExtractionModal,
    closePageExtractionModal,
    toggleSidebar,
    setBookmarkPanelVisible,
    setSidebarVisible,
    toggleCommentMode,
    setComments,
    setSelectedCommentColor,
    registerScrollContainer,
    disableSearchNavigationSync,
    isSearchNavigationActive,
    setTextExtractionProgress
  } = usePDFViewer();

  const toast = useToast();
  const { config: responsiveConfig } = useResponsivePanel();

  const [documentPages, setDocumentPages] = useState<Map<string, number>>(new Map());
  const [documentBookmarks, setDocumentBookmarks] = useState<Map<string, { bookmarks: any[]; documentName: string; documentIndex: number; pageCount: number }>>(new Map());
  const [pdfDocumentProxies, setPdfDocumentProxies] = useState<Map<string, pdfjs.PDFDocumentProxy>>(new Map());
  const [idlePages, setIdlePages] = useState<Set<number>>(new Set());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCommentColorPicker, setShowCommentColorPicker] = useState(false);
  const [showToolbarOverflow, setShowToolbarOverflow] = useState(false);
  const [visitedPages, setVisitedPages] = useState<Set<number>>(new Set());
  const [forceRenderPages, setForceRenderPages] = useState<Set<number>>(new Set());
  const [scrollBasedVisiblePages, setScrollBasedVisiblePages] = useState<Set<number>>(new Set());
  const [pageInputValue, setPageInputValue] = useState<string>('');
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const isSelectingTextRef = useRef(false);
  const isPointerDownInPdfRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const startedInsidePdfRef = useRef(false);
  const hasDragRef = useRef(false);
  const activeCaretElementRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastDetectedPageRef = useRef<number>(1);
  const lastDetectionTimeRef = useRef<number>(0);
  const idleCallbackIdRef = useRef<number | null>(null);
  const renderFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollThrottleRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);
  const prevZoomRef = useRef<number>(state.zoom);
  const prevDisplayZoomRef = useRef<number>(state.displayZoom);
  const isZoomChangingRef = useRef(false);
  const lastZoomTimestampRef = useRef<number>(0);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageBeforeZoomRef = useRef<number>(1);
  const zoomBlockedUntilRef = useRef<number>(0);
  const textExtractionProgressRef = useRef<Map<string, { current: number; total: number }>>(new Map());
  const highlightedPageRef = useRef<number | null>(state.highlightedPage);
  const isModeSwitchingRef = useRef(false);
  const pageBeforeModeSwitchRef = useRef<number>(state.currentPage);
  const prevViewModeRef = useRef<'continuous' | 'paginated'>(state.viewMode);
  const INTERACTION_DEBOUNCE_MS = 200;
  const ZOOM_PROTECTION_DURATION_MS = 500;
  const MAX_PAGE_JUMP = 30;

  useEffect(() => {
    if (!isZoomChangingRef.current) {
      pageBeforeZoomRef.current = state.currentPage;
    }
  }, [state.currentPage]);

  useEffect(() => {
    highlightedPageRef.current = state.highlightedPage;
  }, [state.highlightedPage]);

  useEffect(() => {
    if (isModeSwitchingRef.current && state.currentPage !== pageBeforeModeSwitchRef.current) {
      goToPage(pageBeforeModeSwitchRef.current);
    }
  }, [state.viewMode, state.currentPage, goToPage]);

  useEffect(() => {
    if (prevDisplayZoomRef.current !== state.displayZoom) {
      isZoomChangingRef.current = true;
      lastZoomTimestampRef.current = Date.now();
      prevDisplayZoomRef.current = state.displayZoom;

      const timeoutId = setTimeout(() => {
        isZoomChangingRef.current = false;
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [state.displayZoom]);

  const { selectionsByPage, clearSelection: clearSelectionOverlay } = useSelectionOverlay(scrollContainerRef);

  /**
   * Effect para limpar caches antigos de bookmarks na montagem
   */
  useEffect(() => {
    clearOldBookmarkCaches();
  }, []);

  /**
   * Effect para fechar o menu overflow quando clicar fora
   */
  useEffect(() => {
    if (!showToolbarOverflow) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-toolbar-overflow]')) {
        setShowToolbarOverflow(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showToolbarOverflow]);

  /**
   * Effect para auto-ocultar paineis em telas pequenas
   * para maximizar o espaco do PDF
   */
  useEffect(() => {
    if (responsiveConfig.autoHideBookmarkPanel && state.isBookmarkPanelVisible) {
      setBookmarkPanelVisible(false);
    }
    if (responsiveConfig.autoHideSidebar && state.isSidebarVisible) {
      setSidebarVisible(false);
    }
  }, [responsiveConfig.autoHideBookmarkPanel, responsiveConfig.autoHideSidebar]);

  /**
   * Effect para atualizar a largura do painel quando o tamanho da tela muda
   */
  useEffect(() => {
    const newPanelWidth = responsiveConfig.panelWidthPercent >= 1.0
      ? window.innerWidth
      : Math.floor(window.innerWidth * responsiveConfig.panelWidthPercent);
    setPanelWidth(newPanelWidth);
  }, [responsiveConfig.panelWidthPercent, setPanelWidth]);

  /**
   * Helper para marcar inicio de interacao e agendar fim
   * Quando usuario esta scrollando ou zoomando, desabilitamos layers pesadas
   */
  const markInteractionStart = useCallback(() => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    if (!state.isInteracting) {
      setIsInteracting(true);
    }
    if (!isProgrammaticScrollRef.current && !isSearchNavigationActive()) {
      disableSearchNavigationSync();
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, INTERACTION_DEBOUNCE_MS);
  }, [disableSearchNavigationSync, isSearchNavigationActive, state.isInteracting, setIsInteracting]);

  /**
   * Cleanup do timeout de interacao
   */
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Calcula quais paginas estao visiveis baseado no scrollTop do container
   * Esta funcao e chamada durante o scroll e usa as dimensoes das paginas para determinar
   * quais paginas devem ser renderizadas
   *
   * Protecoes anti-loop:
   * - Ignora durante mudanca de zoom (isZoomChangingRef)
   * - Ignora scroll programatico (isProgrammaticScrollRef)
   * - Debounce para mudancas de 1 pagina (evita oscilacao)
   * - Validacao de sanidade: ignora pulos > MAX_PAGE_JUMP paginas
   * - Bloqueio temporal apos zoom (zoomBlockedUntilRef)
   */
  const calculateVisiblePagesFromScroll = useCallback((options?: { allowLargeJump?: boolean; previousScrollTop?: number }) => {
    const container = scrollContainerRef.current;
    if (!container || state.viewMode !== 'continuous' || state.totalPages === 0) {
      return;
    }

    const now = Date.now();
    if (isZoomChangingRef.current || state.isRotating || isModeSwitchingRef.current) {
      return;
    }

    const skipPageChange = isProgrammaticScrollRef.current ||
      isModeSwitchingRef.current ||
      now < zoomBlockedUntilRef.current ||
      (state.isSearchOpen && (highlightedPageRef.current || isSearchNavigationActive()));

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const buffer = viewportHeight * 1.5;
    const scrollDelta = options?.previousScrollTop !== undefined
      ? Math.abs(scrollTop - options.previousScrollTop)
      : 0;
    const isLargeScrollJump = scrollDelta > viewportHeight * 2;
    const allowLargeJump = Boolean(options?.allowLargeJump || isLargeScrollJump || state.isSearchOpen);

    let accumulatedHeight = 0;
    const visiblePages = new Set<number>();
    const gap = 16;

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      const pageHeight = getPageHeight(pageNum);
      const pageTop = accumulatedHeight;
      const pageBottom = accumulatedHeight + pageHeight;

      const isInViewport = (
        pageBottom >= scrollTop - buffer &&
        pageTop <= scrollTop + viewportHeight + buffer
      );

      if (isInViewport) {
        visiblePages.add(pageNum);
      }

      if (pageTop > scrollTop + viewportHeight + buffer) {
        break;
      }

      accumulatedHeight += pageHeight + gap;
    }

    for (let pageNum = 1; pageNum <= Math.min(5, state.totalPages); pageNum++) {
      visiblePages.add(pageNum);
    }

    setScrollBasedVisiblePages(prev => {
      const prevArray = Array.from(prev).sort((a, b) => a - b);
      const newArray = Array.from(visiblePages).sort((a, b) => a - b);
      if (prevArray.length === newArray.length && prevArray.every((v, i) => v === newArray[i])) {
        return prev;
      }
      return visiblePages;
    });

    const timeSinceLastZoom = now - lastZoomTimestampRef.current;
    if (timeSinceLastZoom < ZOOM_PROTECTION_DURATION_MS || skipPageChange) {
      return;
    }

    const viewportCenter = scrollTop + viewportHeight / 2;
    let centerPage = 1;
    let minDistanceToCenter = Infinity;
    accumulatedHeight = 0;

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      const pageHeight = getPageHeight(pageNum);
      const pageTop = accumulatedHeight;
      const pageBottom = accumulatedHeight + pageHeight;
      const pageCenter = accumulatedHeight + pageHeight / 2;

      const isPageVisible = pageBottom >= scrollTop && pageTop <= scrollTop + viewportHeight;

      if (isPageVisible) {
        const distanceToCenter = Math.abs(pageCenter - viewportCenter);
        if (distanceToCenter < minDistanceToCenter) {
          minDistanceToCenter = distanceToCenter;
          centerPage = pageNum;
        }
      }

      if (pageTop > scrollTop + viewportHeight) {
        break;
      }

      accumulatedHeight += pageHeight + gap;
    }

    const timeSinceLastDetection = now - lastDetectionTimeRef.current;
    const pageDifference = Math.abs(centerPage - lastDetectedPageRef.current);
    const jumpFromCurrentPage = Math.abs(centerPage - state.currentPage);

    if (pageDifference === 1 && timeSinceLastDetection < 300) {
      return;
    }

    if (jumpFromCurrentPage > MAX_PAGE_JUMP && !allowLargeJump) {
      logger.warn(
        `Bloqueado pulo de pagina invalido: ${state.currentPage} -> ${centerPage} (${jumpFromCurrentPage} paginas)`,
        'FloatingPDFViewer.calculateVisiblePagesFromScroll'
      );
      return;
    }

    if (centerPage !== lastDetectedPageRef.current) {
      lastDetectedPageRef.current = centerPage;
      lastDetectionTimeRef.current = now;
      goToPage(centerPage);
    }
  }, [state.viewMode, state.totalPages, state.currentPage, state.isSearchOpen, getPageHeight, goToPage]);

  /**
   * Effect para detectar paginas visiveis durante scroll
   * Usa throttle para performance - atualiza a cada 50ms durante scroll
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous' || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;

    const handleScroll = () => {
      if (isPointerDownRef.current || isSelectingTextRef.current) {
        return;
      }

      markInteractionStart();

      const scrollHeight = container.scrollHeight;
      if (scrollHeight > 0 && !isProgrammaticScrollRef.current) {
        scrollRatioBeforeZoomRef.current = container.scrollTop / scrollHeight;
      }

      const now = Date.now();
      if (now - scrollThrottleRef.current < 100) {
        return;
      }
      scrollThrottleRef.current = now;
      const previousScrollTop = lastScrollTopRef.current;
      lastScrollTopRef.current = container.scrollTop;

      calculateVisiblePagesFromScroll({ previousScrollTop });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    calculateVisiblePagesFromScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [state.viewMode, calculateVisiblePagesFromScroll, markInteractionStart]);

  useEffect(() => {
    registerScrollContainer(scrollContainerRef.current);
    return () => {
      registerScrollContainer(null);
    };
  }, [registerScrollContainer]);

  useEffect(() => {
    if (state.isSearchOpen) {
      calculateVisiblePagesFromScroll({ allowLargeJump: true });
    }
  }, [state.isSearchOpen, calculateVisiblePagesFromScroll]);

  /**
   * Effect para resetar Maps locais quando os documentos mudam
   * Corrige bug onde Maps acumulavam entradas de sessoes anteriores
   */
  useEffect(() => {
    if (state.documents.length > 0) {
      const currentDocIds = new Set(state.documents.map(d => d.id));

      setDocumentPages(prev => {
        const hasStaleEntries = Array.from(prev.keys()).some(id => !currentDocIds.has(id));
        if (hasStaleEntries || prev.size > state.documents.length) {
          return new Map();
        }
        return prev;
      });

      setDocumentBookmarks(prev => {
        const hasStaleEntries = Array.from(prev.keys()).some(id => !currentDocIds.has(id));
        if (hasStaleEntries || prev.size > state.documents.length) {
          setIsLoadingBookmarks(true);
          return new Map();
        }
        return prev;
      });
    }
  }, [state.documents, setIsLoadingBookmarks]);

  /**
   * Effect para carregar highlights quando o PDF é aberto
   */
  useEffect(() => {
    if (!state.isOpen || !processId || state.documents.length === 0) {
      return;
    }

    const loadHighlights = async () => {
      logger.info(
        `Loading highlights for process ${processId}`,
        'FloatingPDFViewer.loadHighlights'
      );

      const highlights = await HighlightsService.getHighlights({ processId });
      setHighlights(highlights);
      logger.success(
        `Loaded ${highlights.length} highlights`,
        'FloatingPDFViewer.loadHighlights'
      );
    };

    loadHighlights();
  }, [state.isOpen, processId, state.documents.length, setHighlights]);

  useEffect(() => {
    if (!state.isOpen || state.documents.length === 0) {
      return;
    }

    const loadComments = async () => {
      try {
        const allComments = [];
        for (const doc of state.documents) {
          const comments = await PDFCommentsService.getCommentsWithConnectorsByDocument(doc.id);
          allComments.push(...comments);
        }
        setComments(allComments);
        logger.info(
          `Loaded ${allComments.length} comments`,
          'FloatingPDFViewer.loadComments'
        );
      } catch (error) {
        logger.error(
          'Error loading comments',
          'FloatingPDFViewer.loadComments',
          { error }
        );
      }
    };

    loadComments();
  }, [state.isOpen, state.documents, setComments]);

  /**
   * Effect para gerenciar o caret piscando (como no Acrobat)
   * - Clique em texto: ativa contenteditable no span, mostra caret
   * - Clique em area vazia: desativa contenteditable, remove foco
   * - Shift+Click: seleciona do anchor ate o ponto clicado
   * - Shift+Setas: estende a selecao
   */
  useEffect(() => {
    let selectionAnchor: { span: HTMLElement; offset: number } | null = null;
    let currentFocus: { span: HTMLElement; offset: number } | null = null;

    const deactivateCaret = () => {
      if (activeCaretElementRef.current) {
        activeCaretElementRef.current.removeAttribute('contenteditable');
        activeCaretElementRef.current.blur();
        activeCaretElementRef.current = null;
      }
      selectionAnchor = null;
      currentFocus = null;
    };

    const activateCaret = (element: HTMLElement, preserveAnchor = false) => {
      if (activeCaretElementRef.current && activeCaretElementRef.current !== element) {
        activeCaretElementRef.current.removeAttribute('contenteditable');
      }
      element.setAttribute('contenteditable', 'true');
      activeCaretElementRef.current = element;
      element.focus({ preventScroll: true });
      if (!preserveAnchor) {
        selectionAnchor = null;
        currentFocus = null;
      }
    };

    const getPageNumber = (element: HTMLElement): number | null => {
      const pageEl = element.closest('[data-global-page]');
      if (!pageEl) return null;
      return parseInt(pageEl.getAttribute('data-global-page') || '0', 10) || null;
    };

    const getSpansForPage = (pageNumber: number): HTMLElement[] => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return [];
      const pageEl = scrollContainer.querySelector(`[data-global-page="${pageNumber}"]`);
      if (!pageEl) return [];
      const spans = pageEl.querySelectorAll('.textLayer > span, .textLayer span[role="presentation"]');
      return Array.from(spans).filter(span => span.textContent?.trim()) as HTMLElement[];
    };

    const getAllTextSpans = (): HTMLElement[] => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return [];
      const spans = scrollContainer.querySelectorAll('.textLayer > span, .textLayer span[role="presentation"]');
      return Array.from(spans).filter(span => span.textContent?.trim()) as HTMLElement[];
    };

    const getCaretPosition = (): number => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return 0;
      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        return range.startOffset;
      }
      return selection.focusOffset;
    };

    const setCaretPosition = (element: HTMLElement, position: number) => {
      const textNode = element.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
      const range = document.createRange();
      const sel = window.getSelection();
      const maxPos = Math.min(position, textNode.textContent?.length || 0);
      range.setStart(textNode, maxPos);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    };

    const createSelectionBetween = (
      startSpan: HTMLElement,
      startOffset: number,
      endSpan: HTMLElement,
      endOffset: number
    ) => {
      const spans = getAllTextSpans();
      const startIndex = spans.indexOf(startSpan);
      const endIndex = spans.indexOf(endSpan);

      if (startIndex === -1 || endIndex === -1) return;

      const sel = window.getSelection();
      if (!sel) return;

      const range = document.createRange();

      let actualStartSpan = startSpan;
      let actualStartOffset = startOffset;
      let actualEndSpan = endSpan;
      let actualEndOffset = endOffset;

      if (startIndex > endIndex || (startIndex === endIndex && startOffset > endOffset)) {
        actualStartSpan = endSpan;
        actualStartOffset = endOffset;
        actualEndSpan = startSpan;
        actualEndOffset = startOffset;
      }

      const startNode = actualStartSpan.firstChild;
      const endNode = actualEndSpan.firstChild;

      if (!startNode || !endNode) return;

      const maxStartOffset = Math.min(actualStartOffset, startNode.textContent?.length || 0);
      const maxEndOffset = Math.min(actualEndOffset, endNode.textContent?.length || 0);

      range.setStart(startNode, maxStartOffset);
      range.setEnd(endNode, maxEndOffset);

      sel.removeAllRanges();
      sel.addRange(range);
    };

    const getClickOffset = (span: HTMLElement, clientX: number): number => {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;

      const text = textNode.textContent || '';
      const range = document.createRange();

      for (let i = 0; i <= text.length; i++) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i);
        const rect = range.getBoundingClientRect();
        if (rect.left >= clientX) {
          return Math.max(0, i);
        }
      }
      return text.length;
    };

    const handleClick = (e: MouseEvent) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const target = e.target as HTMLElement;
      const isInScrollContainer = scrollContainer.contains(target);
      if (!isInScrollContainer) return;

      if (e.detail >= 2) {
        deactivateCaret();
        return;
      }

      const textLayerSpan = target.closest('.textLayer > span, .textLayer span[role="presentation"]') as HTMLElement;

      if (textLayerSpan && textLayerSpan.textContent?.trim()) {
        const clickOffset = getClickOffset(textLayerSpan, e.clientX);

        if (e.shiftKey && selectionAnchor) {
          activateCaret(textLayerSpan, true);
          createSelectionBetween(
            selectionAnchor.span,
            selectionAnchor.offset,
            textLayerSpan,
            clickOffset
          );
          currentFocus = { span: textLayerSpan, offset: clickOffset };
        } else {
          activateCaret(textLayerSpan);
          setCaretPosition(textLayerSpan, clickOffset);
          selectionAnchor = { span: textLayerSpan, offset: clickOffset };
          currentFocus = { span: textLayerSpan, offset: clickOffset };
        }
      } else {
        deactivateCaret();
      }
    };

    const handleBeforeInput = (e: InputEvent) => {
      if (activeCaretElementRef.current && activeCaretElementRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    const findNearestSpanVertically = (currentSpan: HTMLElement, direction: 'up' | 'down'): HTMLElement | null => {
      const pageNumber = getPageNumber(currentSpan);
      if (!pageNumber) return null;
      const spans = getSpansForPage(pageNumber);
      const currentRect = currentSpan.getBoundingClientRect();
      const currentCenterX = currentRect.left + currentRect.width / 2;

      let bestSpan: HTMLElement | null = null;
      let bestDistance = Infinity;

      for (const span of spans) {
        if (span === currentSpan) continue;
        const rect = span.getBoundingClientRect();

        const isInCorrectDirection = direction === 'down'
          ? rect.top > currentRect.bottom - 5
          : rect.bottom < currentRect.top + 5;

        if (!isInCorrectDirection) continue;

        const verticalDist = direction === 'down'
          ? rect.top - currentRect.bottom
          : currentRect.top - rect.bottom;
        const horizontalDist = Math.abs((rect.left + rect.width / 2) - currentCenterX);
        const distance = verticalDist * 10 + horizontalDist;

        if (distance < bestDistance) {
          bestDistance = distance;
          bestSpan = span;
        }
      }

      return bestSpan;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCaretElementRef.current) return;
      if (!activeCaretElementRef.current.contains(e.target as Node)) return;

      const currentSpan = activeCaretElementRef.current;
      const textLength = currentSpan.textContent?.length || 0;
      const isShift = e.shiftKey;

      if (e.key === 'Escape') {
        deactivateCaret();
        return;
      }

      const focusPos = currentFocus?.span === currentSpan ? currentFocus.offset : getCaretPosition();

      if (!selectionAnchor) {
        selectionAnchor = { span: currentSpan, offset: focusPos };
        currentFocus = { span: currentSpan, offset: focusPos };
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const pageNumber = getPageNumber(currentSpan);
        if (!pageNumber) return;
        const spans = getSpansForPage(pageNumber);
        const currentIndex = spans.indexOf(currentSpan);
        if (currentIndex === -1) return;

        if (focusPos >= textLength && currentIndex < spans.length - 1) {
          const nextSpan = spans[currentIndex + 1];
          activateCaret(nextSpan, isShift);
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, nextSpan, 0);
            currentFocus = { span: nextSpan, offset: 0 };
          } else {
            setCaretPosition(nextSpan, 0);
            selectionAnchor = { span: nextSpan, offset: 0 };
            currentFocus = { span: nextSpan, offset: 0 };
          }
        } else if (focusPos < textLength) {
          const newPos = focusPos + 1;
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, currentSpan, newPos);
            currentFocus = { span: currentSpan, offset: newPos };
          } else {
            setCaretPosition(currentSpan, newPos);
            selectionAnchor = { span: currentSpan, offset: newPos };
            currentFocus = { span: currentSpan, offset: newPos };
          }
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const pageNumber = getPageNumber(currentSpan);
        if (!pageNumber) return;
        const spans = getSpansForPage(pageNumber);
        const currentIndex = spans.indexOf(currentSpan);
        if (currentIndex === -1) return;

        if (focusPos === 0 && currentIndex > 0) {
          const prevSpan = spans[currentIndex - 1];
          const prevLength = prevSpan.textContent?.length || 0;
          activateCaret(prevSpan, isShift);
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, prevSpan, prevLength);
            currentFocus = { span: prevSpan, offset: prevLength };
          } else {
            setCaretPosition(prevSpan, prevLength);
            selectionAnchor = { span: prevSpan, offset: prevLength };
            currentFocus = { span: prevSpan, offset: prevLength };
          }
        } else if (focusPos > 0) {
          const newPos = focusPos - 1;
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, currentSpan, newPos);
            currentFocus = { span: currentSpan, offset: newPos };
          } else {
            setCaretPosition(currentSpan, newPos);
            selectionAnchor = { span: currentSpan, offset: newPos };
            currentFocus = { span: currentSpan, offset: newPos };
          }
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const nextSpan = findNearestSpanVertically(currentSpan, 'down');
        if (nextSpan) {
          const newPos = Math.min(focusPos, nextSpan.textContent?.length || 0);
          activateCaret(nextSpan, isShift);
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, nextSpan, newPos);
            currentFocus = { span: nextSpan, offset: newPos };
          } else {
            setCaretPosition(nextSpan, newPos);
            selectionAnchor = { span: nextSpan, offset: newPos };
            currentFocus = { span: nextSpan, offset: newPos };
          }
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const prevSpan = findNearestSpanVertically(currentSpan, 'up');
        if (prevSpan) {
          const newPos = Math.min(focusPos, prevSpan.textContent?.length || 0);
          activateCaret(prevSpan, isShift);
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, prevSpan, newPos);
            currentFocus = { span: prevSpan, offset: newPos };
          } else {
            setCaretPosition(prevSpan, newPos);
            selectionAnchor = { span: prevSpan, offset: newPos };
            currentFocus = { span: prevSpan, offset: newPos };
          }
        }
        return;
      }

      const allowedKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!allowedKeys.includes(e.key)) {
        e.preventDefault();
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('beforeinput', handleBeforeInput);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('beforeinput', handleBeforeInput);
      document.removeEventListener('keydown', handleKeyDown, true);
      deactivateCaret();
    };
  }, []);

  /**
   * Effect para detectar seleção de texto com pointer events
   * Usa pointerdown/pointermove/pointerup para detectar arrasto real (não cliques simples)
   * Previne falsos positivos de selectstart que dispara até em cliques simples
   *
   * IMPORTANTE: Os handlers verificam scrollContainerRef.current internamente
   * para evitar problemas de timing onde o ref não está disponível na montagem inicial
   */
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      isPointerDownRef.current = true;
      const target = e.target as HTMLElement;
      const isInsidePdf = scrollContainer.contains(target);
      const isInTextLayer = !!target.closest('.textLayer');
      const isInReactPdfPage = !!target.closest('.react-pdf__Page');
      startedInsidePdfRef.current = isInsidePdf || isInTextLayer || isInReactPdfPage;

      if (startedInsidePdfRef.current) {
        isPointerDownInPdfRef.current = true;
        hasDragRef.current = false;
      }

      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] pointerdown', {
          target: target?.tagName,
          className: target?.className?.toString?.()?.substring(0, 50),
          isInsidePdf,
          isInTextLayer,
          isInReactPdfPage,
          startedInsidePdf: startedInsidePdfRef.current,
          timestamp: Date.now()
        });
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPointerDownInPdfRef.current && (e.buttons === 1 || e.pressure > 0)) {
        if (!hasDragRef.current) {
          hasDragRef.current = true;
          isSelectingTextRef.current = true;
        }

        if (PDF_DEBUG) {
          const selection = window.getSelection();
          console.log('[PDF-DEBUG] pointermove', {
            hasDrag: hasDragRef.current,
            selectionLength: selection?.toString().length || 0
          });
        }
      }
    };

    const handlePointerUp = () => {
      const scrollContainer = scrollContainerRef.current;

      isPointerDownRef.current = false;

      const selection = window.getSelection();
      const selectedText = extractTextFromSelection(selection);
      const hasValidSelection = selectedText.length > 0;
      const anchorInPdf = scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode);
      const focusInPdf = scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode);
      const startedInside = startedInsidePdfRef.current;

      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] pointerup', {
          selectionText: selectedText.substring(0, 30),
          hasValidSelection,
          anchorInPdf,
          focusInPdf,
          startedInside,
          willAccept: hasValidSelection && anchorInPdf && startedInside
        });
      }

      if (hasValidSelection && anchorInPdf && startedInside) {
        isSelectingTextRef.current = true;
      } else {
        isSelectingTextRef.current = false;
        startedInsidePdfRef.current = false;
      }

      isPointerDownInPdfRef.current = false;
      hasDragRef.current = false;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  /**
   * Effect para preload imediato de páginas vizinhas + cache de páginas visitadas
   * V4: Preload imediato para +-2 páginas, idle para +-3,+-4
   * Cache mantém últimas 10 páginas visitadas para navegação rápida
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous') return;

    setVisitedPages(prev => {
      const newSet = new Set(prev);
      newSet.add(state.currentPage);

      if (newSet.size > 5) {
        const pagesArray = Array.from(newSet);
        const sortedByDistance = pagesArray.sort((a, b) => {
          const distA = Math.abs(a - state.currentPage);
          const distB = Math.abs(b - state.currentPage);
          return distB - distA;
        });

        while (newSet.size > 5) {
          const farthest = sortedByDistance.shift();
          if (farthest !== undefined && farthest !== state.currentPage) {
            newSet.delete(farthest);
          }
        }
      }

      return newSet;
    });

    const immediatePagesToPreload = new Set<number>();
    for (let offset = -1; offset <= 1; offset++) {
      const page = state.currentPage + offset;
      if (page >= 1 && page <= state.totalPages) {
        immediatePagesToPreload.add(page);
      }
    }

    if (idleCallbackIdRef.current) {
      cancelIdleCallback(idleCallbackIdRef.current);
    }

    idleCallbackIdRef.current = requestIdleCallback(() => {
      const additionalPages = new Set<number>();

      for (let offset = -2; offset <= 2; offset++) {
        if (Math.abs(offset) > 1) {
          const page = state.currentPage + offset;
          if (page >= 1 && page <= state.totalPages) {
            additionalPages.add(page);
          }
        }
      }

      setIdlePages(prev => {
        const combined = new Set([...immediatePagesToPreload, ...additionalPages]);
        return combined;
      });
    });

    setIdlePages(immediatePagesToPreload);

    return () => {
      if (idleCallbackIdRef.current) {
        cancelIdleCallback(idleCallbackIdRef.current);
      }
    };
  }, [state.currentPage, state.totalPages, state.viewMode]);

  /**
   * Handler quando PDF é carregado com sucesso
   * Armazena o número de páginas de cada documento e calcula o total
   * Usa cache de bookmarks quando disponível para melhor performance
   */
  const onDocumentLoadSuccess = useCallback(async (pdf: any, documentIndex: number) => {
    const { numPages } = pdf;
    const currentDoc = state.documents[documentIndex];

    logger.success(
      `PDF carregado: ${currentDoc?.fileName || 'desconhecido'} com ${numPages} páginas (doc ${documentIndex + 1}/${state.documents.length})`,
      'FloatingPDFViewer.onDocumentLoadSuccess'
    );

    setPdfDocumentProxies(prev => {
      const newMap = new Map(prev);
      newMap.set(currentDoc.id, pdf);
      return newMap;
    });

    const recalcExtractionProgress = () => {
      if (textExtractionProgressRef.current.size === 0) {
        setTextExtractionProgress(null);
        return;
      }
      let aggregateCurrent = 0;
      let aggregateTotal = 0;
      textExtractionProgressRef.current.forEach(value => {
        aggregateCurrent += value.current;
        aggregateTotal += value.total;
      });
      setTextExtractionProgress({ current: aggregateCurrent, total: aggregateTotal });
    };

    const updateExtractionProgress = (documentId: string, current: number, total: number) => {
      textExtractionProgressRef.current.set(documentId, { current, total });
      recalcExtractionProgress();
    };

    updateExtractionProgress(currentDoc.id, 0, numPages);

    extractAllPagesText(
      pdf,
      currentDoc.id,
      (current, total) => updateExtractionProgress(currentDoc.id, current, total)
    ).then(() => {
      textExtractionProgressRef.current.delete(currentDoc.id);
      recalcExtractionProgress();
      logger.success(
        `Text extracted and persisted for document ${currentDoc.id}`,
        'FloatingPDFViewer.onDocumentLoadSuccess'
      );
    }).catch((error) => {
      textExtractionProgressRef.current.delete(currentDoc.id);
      recalcExtractionProgress();
      logger.warn(
        `Failed to extract text for document ${currentDoc.id}`,
        error,
        'FloatingPDFViewer.onDocumentLoadSuccess'
      );
    });

    setDocumentPages(prev => {
      const newMap = new Map(prev);
      newMap.set(currentDoc.id, numPages);
      return newMap;
    });

    setIsLoadingBookmarks(true);

    const documentInfo: DocumentInfo = {
      documentId: currentDoc.id,
      documentIndex: documentIndex,
      documentName: currentDoc.displayName || currentDoc.fileName,
      pageOffset: 0
    };

    const cacheKey = generatePDFCacheKey(currentDoc.url, numPages, currentDoc.id);

    try {
      const cachedBookmarks = loadBookmarksFromCache(cacheKey);
      let bookmarks: any[];

      if (cachedBookmarks) {
        bookmarks = cachedBookmarks;
      } else {
        bookmarks = await extractBookmarksWithDocumentInfo(pdf, documentInfo);
        saveBookmarksToCache(cacheKey, bookmarks);
      }

      setDocumentBookmarks(prev => {
        const newMap = new Map(prev);
        newMap.set(currentDoc.id, {
          bookmarks,
          documentName: documentInfo.documentName,
          documentIndex: documentInfo.documentIndex,
          pageCount: numPages
        });

        if (newMap.size === state.documents.length) {
          const mergedBookmarks = mergeBookmarksFromMultipleDocuments(newMap);
          setBookmarks(mergedBookmarks);
          setIsLoadingBookmarks(false);

          logger.success(
            `Todos os ${state.documents.length} documentos processados. Bookmarks mesclados com sucesso.`,
            'FloatingPDFViewer.onDocumentLoadSuccess'
          );
        }

        return newMap;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      // Registra erro mas não bloqueia outros documentos
      logger.warn(
        `Erro ao extrair bookmarks do documento "${documentInfo.documentName}"`,
        error,
        'FloatingPDFViewer.onDocumentLoadSuccess'
      );

      setDocumentBookmarks(prev => {
        const newMap = new Map(prev);
        newMap.set(currentDoc.id, {
          bookmarks: [],
          documentName: documentInfo.documentName,
          documentIndex: documentInfo.documentIndex,
          pageCount: numPages
        });

        if (newMap.size === state.documents.length) {
          const mergedBookmarks = mergeBookmarksFromMultipleDocuments(newMap);
          setBookmarks(mergedBookmarks);
          setIsLoadingBookmarks(false);

          if (mergedBookmarks.length === 0) {
            setBookmarksError('Nenhum bookmark encontrado nos documentos');
          }
        }

        return newMap;
      });
    }
  }, [state.documents, setBookmarks, setIsLoadingBookmarks, setBookmarksError, setTextExtractionProgress]);

  /**
   * Calcula o offset de página global para cada documento
   * Retorna um Map com o offset de início de cada documento
   */
  const getDocumentOffsets = useCallback(() => {
    const offsets = new Map<string, { startPage: number; endPage: number; numPages: number }>();
    let currentOffset = 1;

    state.documents.forEach(doc => {
      const numPages = documentPages.get(doc.id) || 0;
      if (numPages > 0) {
        offsets.set(doc.id, {
          startPage: currentOffset,
          endPage: currentOffset + numPages - 1,
          numPages: numPages
        });
        currentOffset += numPages;
      }
    });

    return offsets;
  }, [state.documents, documentPages]);

  const memoizedDocumentOffsets = useMemo(() => {
    return getDocumentOffsets();
  }, [getDocumentOffsets]);

  useEffect(() => {
    if (state.documents.length === 0 || documentPages.size === 0) return;

    const pageInfo = state.documents.map((doc, index) => {
      const offset = memoizedDocumentOffsets.get(doc.id);
      if (!offset) return null;
      return {
        documentIndex: index,
        globalPageStart: offset.startPage,
        globalPageEnd: offset.endPage,
        pageCount: offset.numPages
      };
    }).filter(Boolean) as { documentIndex: number; globalPageStart: number; globalPageEnd: number; pageCount: number }[];

    if (pageInfo.length > 0) {
      setDocumentPageInfo(pageInfo);
    }

    let totalPages = 0;
    state.documents.forEach(doc => {
      const docPages = documentPages.get(doc.id);
      if (docPages) {
        totalPages += docPages;
      }
    });

    if (totalPages > 0) {
      setTotalPages(totalPages);
      logger.info(
        `Total de páginas atualizado: ${totalPages} (${documentPages.size}/${state.documents.length} documentos carregados)`,
        'FloatingPDFViewer.useEffect[documentPages]'
      );
    }
  }, [state.documents, memoizedDocumentOffsets, documentPages, setDocumentPageInfo, setTotalPages]);

  const pagesToRender = useMemo(() => {
    if (state.viewMode !== 'continuous') return new Set<number>();

    const pages = new Set<number>();

    scrollBasedVisiblePages.forEach(page => pages.add(page));
    idlePages.forEach(page => pages.add(page));
    forceRenderPages.forEach(page => pages.add(page));

    for (let i = -1; i <= 1; i++) {
      const page = state.currentPage + i;
      if (page >= 1 && page <= state.totalPages) {
        pages.add(page);
      }
    }

    return pages;
  }, [state.viewMode, state.currentPage, state.totalPages, scrollBasedVisiblePages, idlePages, forceRenderPages]);

  /**
   * Encontra qual documento contém uma determinada página global
   */
  const findDocumentByGlobalPage = useCallback((globalPage: number) => {
    const offsets = memoizedDocumentOffsets;

    for (const [docIndex, doc] of state.documents.entries()) {
      const offset = offsets.get(doc.id);
      if (offset && globalPage >= offset.startPage && globalPage <= offset.endPage) {
        return {
          document: doc,
          documentIndex: docIndex,
          localPage: globalPage - offset.startPage + 1,
          offset: offset
        };
      }
    }

    return null;
  }, [state.documents, memoizedDocumentOffsets]);

  /**
   * Handler para navegação manual de página (input direto)
   * Sincroniza as referências de detecção para evitar conflitos
   */
  const handleManualPageNavigation = useCallback((pageNum: number) => {
    if (state.viewMode === 'continuous') {
      isProgrammaticScrollRef.current = true;
      lastDetectedPageRef.current = pageNum;
      lastDetectionTimeRef.current = Date.now();
    }

    goToPage(pageNum);

    if (state.viewMode === 'continuous') {
      const pageElement = pageRefs.current.get(pageNum);
      if (pageElement && scrollContainerRef.current) {
        pageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 400);
    }
  }, [goToPage, state.viewMode]);

  /**
   * Handler para cliques em links internos do PDF (ex: sumário)
   * Nota: Funcionalidade simplificada - links internos do PDF não estão totalmente implementados
   */
  const onItemClick = useCallback(({ pageIndex, pageNumber }: {
    dest?: any;
    pageIndex?: number;
    pageNumber?: number;
  }) => {
    // Tenta usar pageIndex primeiro (0-based), depois pageNumber (1-based)
    const targetPage = pageIndex !== undefined ? pageIndex + 1 : pageNumber;

    if (targetPage && targetPage > 0 && targetPage <= state.totalPages) {
      handleManualPageNavigation(targetPage);
    }
  }, [state.totalPages, handleManualPageNavigation]);

  /**
   * Handler de erro no carregamento do PDF
   */
  const onDocumentLoadError = useCallback((error: Error) => {
    const currentDoc = getCurrentDocument();

    logger.errorWithException(
      'Erro ao carregar PDF',
      error,
      'FloatingPDFViewer.onDocumentLoadError',
      { fileName: currentDoc?.fileName, url: currentDoc?.url }
    );

    const errorMessage = error.message || 'Erro desconhecido';

    if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      toast.error('Erro de CORS: O PDF nao pode ser carregado devido a restricoes de seguranca. Verifique as configuracoes do bucket Supabase.');
    } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      toast.error('Arquivo nao encontrado. Tente fazer upload do documento novamente.');
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      toast.error('Acesso negado. Verifique as politicas de acesso no Supabase.');
    } else {
      toast.error(`Erro ao carregar PDF: ${errorMessage}`);
    }
  }, [getCurrentDocument, toast]);

  /**
   * Handler para seleção de texto no PDF
   * Captura texto e posição da seleção com múltiplos retângulos para texto multi-linha
   * CORREÇÃO: Não chama clearSelection() automaticamente para evitar ciclos de re-render
   * CORREÇÃO: Filtra seleções de fora do container PDF
   */
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = extractTextFromSelection(selection);

    if (PDF_DEBUG) {
      console.log('[PDF-DEBUG] handleTextSelection - START', {
        selectedText: selectedText.substring(0, 30),
        length: selectedText.length,
        startedInsidePdf: startedInsidePdfRef.current,
        rangeCount: selection?.rangeCount,
        timestamp: Date.now()
      });
    }

    if (!selectedText || selectedText.length < 3) {
      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] handleTextSelection - skipped: text too short', { length: selectedText.length });
      }
      return;
    }

    if (!startedInsidePdfRef.current) {
      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] handleTextSelection - skipped: selection did not start inside PDF', {
          startedInsidePdfRef: startedInsidePdfRef.current
        });
      }
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const anchorNode = selection?.anchorNode;
    const focusNode = selection?.focusNode;
    if (!anchorNode || !focusNode) {
      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] handleTextSelection - skipped: missing anchor or focus node');
      }
      return;
    }
    if (!scrollContainer.contains(anchorNode) && !scrollContainer.contains(focusNode)) {
      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] handleTextSelection - skipped: anchor/focus not in PDF container');
      }
      return;
    }

    try {
      const range = selection?.getRangeAt(0);
      if (!range) return;

      if (!scrollContainer.contains(range.commonAncestorContainer)) {
        if (PDF_DEBUG) {
          console.log('[PDF-DEBUG] handleTextSelection - skipped: commonAncestorContainer not in PDF');
        }
        return;
      }

      let pageWrapper: HTMLElement | null = null;
      let extractedPageNumber: number | undefined = undefined;
      let node = range.commonAncestorContainer;

      while (node && node !== document.body) {
        const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
        if (element?.hasAttribute('data-global-page')) {
          pageWrapper = element;
          extractedPageNumber = parseInt(element.getAttribute('data-global-page') || '0', 10);
          break;
        }
        node = node.parentNode as Node;
      }

      if (!pageWrapper) {
        logger.warn(
          'Não foi possível encontrar container da página',
          'FloatingPDFViewer.handleTextSelection'
        );
        const rect = range.getBoundingClientRect();
        setSelectedText(selectedText, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          viewportX: rect.left,
          viewportY: rect.top,
          pageNumber: state.currentPage
        });
        return;
      }

      const textLayer = pageWrapper.querySelector('.textLayer') ||
                        pageWrapper.querySelector('.react-pdf__Page__textContent');
      const referenceEl = textLayer || pageWrapper;
      const referenceRect = referenceEl.getBoundingClientRect();
      const pageRect = pageWrapper.getBoundingClientRect();

      const offsetX = referenceRect.left - pageRect.left;
      const offsetY = referenceRect.top - pageRect.top;

      const clientRects = range.getClientRects();
      const currentZoom = state.displayZoom || state.zoom;

      const rawRects: Array<{ x: number; y: number; width: number; height: number }> = [];

      for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i];

        if (rect.width < 2 || rect.height < 2) continue;

        rawRects.push({
          x: ((rect.left - referenceRect.left) + offsetX) / currentZoom,
          y: ((rect.top - referenceRect.top) + offsetY) / currentZoom,
          width: rect.width / currentZoom,
          height: rect.height / currentZoom
        });
      }

      const rects = mergeRectsIntoLines(rawRects, 3 / currentZoom);

      const firstRect = clientRects[0];
      const lastRect = clientRects[clientRects.length - 1];

      const viewportWidth = Math.max(firstRect.width, lastRect.right - firstRect.left);
      const viewportHeight = lastRect.bottom - firstRect.top;

      const actualPageNumber = extractedPageNumber || state.currentPage;

      const position = {
        x: ((firstRect.left - referenceRect.left) + offsetX) / currentZoom,
        y: ((firstRect.top - referenceRect.top) + offsetY) / currentZoom,
        width: viewportWidth / currentZoom,
        height: viewportHeight / currentZoom,
        rects,
        viewportX: firstRect.left,
        viewportY: firstRect.top,
        viewportWidth,
        viewportHeight,
        pageNumber: actualPageNumber
      };

      setSelectedText(selectedText, position);

      if (PDF_DEBUG) {
        console.log('[PDF-DEBUG] handleTextSelection - SUCCESS', {
          textPreview: selectedText.substring(0, 50),
          length: selectedText.length,
          rawRectsCount: rawRects.length,
          mergedRectsCount: rects.length
        });
      }

      logger.info(
        `Texto selecionado: ${selectedText.substring(0, 50)}...`,
        'FloatingPDFViewer.handleTextSelection',
        {
          length: selectedText.length,
          rawRectsCount: rawRects.length,
          mergedRectsCount: rects.length,
          zoom: state.zoom,
          displayZoom: state.displayZoom
        }
      );

      startedInsidePdfRef.current = false;
    } catch (error) {
      logger.error(
        'Erro ao capturar posição da seleção',
        'FloatingPDFViewer.handleTextSelection',
        undefined,
        error
      );
      setSelectedText(selectedText);
      startedInsidePdfRef.current = false;
    }
  }, [setSelectedText, state.currentPage, state.zoom]);

  const getCommentFieldForCurrentMode = useCallback((): InsertionField => {
    const formMode = state.formMode;
    if (formMode === 'create-decision' || formMode === 'edit-decision') {
      return 'comentariosDecisao';
    }
    if (formMode === 'create-documento' || formMode === 'edit-documento') {
      return 'comentariosDocumento';
    }
    return 'comentariosCalculistas';
  }, [state.formMode]);

  /**
   * Handler para inserir texto em campo específico
   * Se for "fundamentacao", cria automaticamente um highlight azul
   */
  const handleInsertInField = useCallback(async (field: InsertionField) => {
    if (!state.selectedText) {
      logger.warn('Nenhum texto selecionado para inserir', 'FloatingPDFViewer');
      return;
    }

    // Se for fundamentação, criar highlight azul automaticamente
    if (field === 'fundamentacao' && state.selectionPosition && processId) {
      const targetPageNumber = state.selectionPosition.pageNumber || state.currentPage;
      const targetDoc = getDocumentByGlobalPage(targetPageNumber);
      if (targetDoc) {

        logger.info(
          'Criando highlight azul automaticamente para fundamentação',
          'FloatingPDFViewer.handleInsertInField',
          { targetPageNumber, extractedPage: state.selectionPosition.pageNumber, currentPage: state.currentPage }
        );

        const highlight = await HighlightsService.createHighlight({
          processId,
          processDocumentId: targetDoc.id,
          pageNumber: targetPageNumber,
          selectedText: state.selectedText,
          positionData: {
            x: state.selectionPosition.x,
            y: state.selectionPosition.y,
            width: state.selectionPosition.width,
            height: state.selectionPosition.height,
            pageNumber: targetPageNumber,
            rects: state.selectionPosition.rects
          },
          color: 'blue'
        });

        if (highlight) {
          // Adiciona o highlight ao estado
          addHighlight(highlight);

          addHighlightIdToLink(highlight.id);

          logger.success(
            'Highlight azul criado automaticamente',
            'FloatingPDFViewer.handleInsertInField',
            { highlightId: highlight.id }
          );
        } else {
          logger.warn(
            'Falha ao criar highlight automático, continuando sem vínculo',
            'FloatingPDFViewer.handleInsertInField'
          );
        }
      }
    }

    const formattedText = formatPDFText(state.selectedText);
    const quotedText = `[...] "${formattedText}"`;
    const success = insertTextInField(field, quotedText);

    if (success) {
      const fieldNames: Record<InsertionField, string> = {
        'fundamentacao': 'Fundamentacao',
        'comentariosCalculistas': 'Comentarios Calculistas',
        'comentariosDecisao': 'Comentarios da Decisao',
        'comentariosDocumento': 'Comentarios do Documento'
      };
      const fieldName = fieldNames[field] || field;
      toast.success(`Texto formatado e inserido em ${fieldName}!`);
      logger.success(
        `Texto formatado e inserido em ${fieldName}`,
        'FloatingPDFViewer.handleInsertInField',
        { field, originalLength: state.selectedText.length, formattedLength: quotedText.length }
      );
      clearSelection();
    } else {
      toast.error('O campo de destino nao esta disponivel. Certifique-se de que esta na aba correta.');
    }
  }, [
    state.selectedText,
    state.selectionPosition,
    state.currentPage,
    processId,
    getDocumentByGlobalPage,
    addHighlight,
    addHighlightIdToLink,
    insertTextInField,
    clearSelection,
    toast
  ]);

  /**
   * Copiar texto selecionado para clipboard
   */
  const handleCopyText = useCallback(() => {
    if (!state.selectedText) return;

    const formattedText = formatPDFText(state.selectedText);

    navigator.clipboard.writeText(formattedText).then(() => {
      toast.success('Texto formatado e copiado para a area de transferencia!');
      logger.success(
        'Texto formatado e copiado para clipboard',
        'FloatingPDFViewer.handleCopyText',
        { originalLength: state.selectedText.length, formattedLength: formattedText.length }
      );
    }).catch((error) => {
      toast.error('Erro ao copiar texto para a area de transferencia');
      logger.errorWithException(
        'Erro ao copiar texto',
        error as Error,
        'FloatingPDFViewer.handleCopyText'
      );
    });
  }, [state.selectedText, toast]);

  /**
   * Create highlight from selected text
   */
  const handleCreateHighlight = useCallback(async () => {
    if (!state.selectedText || !state.selectionPosition || !processId) {
      logger.warn('Missing data for highlight creation', 'FloatingPDFViewer.handleCreateHighlight');
      return;
    }

    const targetPageNumber = state.selectionPosition.pageNumber || state.currentPage;
    const targetDoc = getDocumentByGlobalPage(targetPageNumber);
    if (!targetDoc) {
      logger.warn('No document found for page', 'FloatingPDFViewer.handleCreateHighlight');
      return;
    }

    logger.info(
      `Creating highlight on page ${targetPageNumber}`,
      'FloatingPDFViewer.handleCreateHighlight',
      { color: state.selectedHighlightColor, textLength: state.selectedText.length, extractedPage: state.selectionPosition.pageNumber, currentPage: state.currentPage, documentId: targetDoc.id }
    );

    const highlight = await HighlightsService.createHighlight({
      processId,
      processDocumentId: targetDoc.id,
      pageNumber: targetPageNumber,
      selectedText: state.selectedText,
      positionData: {
        x: state.selectionPosition.x,
        y: state.selectionPosition.y,
        width: state.selectionPosition.width,
        height: state.selectionPosition.height,
        pageNumber: targetPageNumber,
        rects: state.selectionPosition.rects
      },
      color: state.selectedHighlightColor
    });

    if (highlight) {
      addHighlight(highlight);
      clearSelection();
      logger.success(
        `Highlight created successfully`,
        'FloatingPDFViewer.handleCreateHighlight',
        { highlightId: highlight.id }
      );
    } else {
      toast.error('Erro ao criar destaque. Tente novamente.');
    }
  }, [
    state.selectedText,
    state.selectionPosition,
    state.currentPage,
    state.selectedHighlightColor,
    processId,
    getDocumentByGlobalPage,
    addHighlight,
    clearSelection,
    toast
  ]);


  /**
   * Effect para capturar seleção de texto (mouse e teclado)
   */
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
        const selection = window.getSelection();
        const text = selection?.toString() || '';
        if (text.length >= 3) {
          const scrollContainer = scrollContainerRef.current;
          if (scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode)) {
            startedInsidePdfRef.current = true;
            handleTextSelection();
          }
        }
      }
    };

    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleTextSelection]);

  /**
   * Wrappers para navegação de página com bloqueio durante rotação
   * CORREÇÃO: Define isProgrammaticScrollRef ANTES de atualizar estado
   * para evitar condição de corrida com a detecção de scroll
   */
  const handlePreviousPage = useCallback(() => {
    if (state.isRotating) return;
    if (state.currentPage <= 1) return;

    if (state.viewMode === 'continuous') {
      isProgrammaticScrollRef.current = true;
    }
    previousPage();
  }, [previousPage, state.isRotating, state.currentPage, state.viewMode]);

  const handleNextPage = useCallback(() => {
    if (state.isRotating) return;
    if (state.currentPage >= state.totalPages) return;

    if (state.viewMode === 'continuous') {
      isProgrammaticScrollRef.current = true;
    }
    nextPage();
  }, [nextPage, state.isRotating, state.currentPage, state.totalPages, state.viewMode]);

  const handleToggleViewMode = useCallback(() => {
    isModeSwitchingRef.current = true;
    pageBeforeModeSwitchRef.current = state.currentPage;
    isProgrammaticScrollRef.current = true;
    lastDetectedPageRef.current = state.currentPage;
    lastDetectionTimeRef.current = Date.now();
    toggleViewMode();
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      isModeSwitchingRef.current = false;
    }, 500);
  }, [toggleViewMode, state.currentPage]);

  useLayoutEffect(() => {
    const prevMode = prevViewModeRef.current;
    const currentMode = state.viewMode;

    if (prevMode === currentMode) return;

    prevViewModeRef.current = currentMode;

    if (currentMode === 'paginated' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    } else if (currentMode === 'continuous' && prevMode === 'paginated' && scrollContainerRef.current) {
      setIsModeTransitioning(true);
      isProgrammaticScrollRef.current = true;
      const targetPage = pageBeforeModeSwitchRef.current;

      const scrollToTargetPage = () => {
        const pageElement = pageRefs.current.get(targetPage);
        if (pageElement && scrollContainerRef.current) {
          pageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
          requestAnimationFrame(() => {
            setIsModeTransitioning(false);
            setTimeout(() => {
              isProgrammaticScrollRef.current = false;
            }, 300);
          });
        } else {
          setTimeout(scrollToTargetPage, 16);
        }
      };

      scrollToTargetPage();
    }
  }, [state.viewMode]);

  /**
   * Effect para navegação por teclado
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearch();
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextPage();
          break;
        case 'PageUp':
          e.preventDefault();
          handlePreviousPage();
          break;
        case 'PageDown':
          e.preventDefault();
          handleNextPage();
          break;
        case 'Home':
          e.preventDefault();
          handleManualPageNavigation(1);
          break;
        case 'End':
          e.preventDefault();
          handleManualPageNavigation(state.totalPages);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePreviousPage, handleNextPage, handleManualPageNavigation, state.totalPages, toggleSearch]);

  /**
   * Callback para quando uma página é renderizada - captura suas dimensões reais
   * IMPORTANTE: react-pdf retorna dimensões JÁ ESCALADAS pelo zoom, então
   * precisamos normalizar dividindo pelo zoom atual para armazenar dimensões BASE
   * Também armazena rotação interna do PDF para uso no cálculo de dimensões
   */
  const onPageLoadSuccess = useCallback((page: any, pageNumber: number) => {
    const { width, height, rotate: internalRotation } = page;
    const baseWidth = width / state.zoom;
    const baseHeight = height / state.zoom;
    setPageDimensions(pageNumber, {
      width: baseWidth,
      height: baseHeight,
      internalRotation: internalRotation || 0
    });

    if (PDF_DEBUG) {
      logger.info(
        `Página ${pageNumber} carregada: ${Math.round(baseWidth)}x${Math.round(baseHeight)}px (base), rotação interna: ${internalRotation || 0}°`,
        'FloatingPDFViewer.onPageLoadSuccess'
      );
    }
  }, [setPageDimensions, state.zoom]);

  /**
   * Effect para fallback de renderização - garante que a página atual sempre renderize
   * Se após 500ms a página ainda não estiver no range, força sua renderização
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous') return;

    if (renderFallbackTimeoutRef.current) {
      clearTimeout(renderFallbackTimeoutRef.current);
    }

    renderFallbackTimeoutRef.current = setTimeout(() => {
      const distanceFromCurrent = Math.abs(state.currentPage - state.currentPage);
      const isInImmediateRange = distanceFromCurrent <= 2;
      const isInIdlePages = idlePages.has(state.currentPage);
      const isInVisitedPages = visitedPages.has(state.currentPage);

      if (!isInImmediateRange && !isInIdlePages && !isInVisitedPages) {
        setForceRenderPages(prev => {
          const newSet = new Set(prev);
          newSet.add(state.currentPage);
          return newSet;
        });
      }
    }, 500);

    return () => {
      if (renderFallbackTimeoutRef.current) {
        clearTimeout(renderFallbackTimeoutRef.current);
      }
    };
  }, [state.currentPage, state.viewMode, idlePages, visitedPages]);

  /**
   * Effect para scroll instantâneo até página quando highlightedPage muda (navegação manual explícita)
   * CORREÇÃO DE BUG: Usa highlightedPage como trigger e marca scroll como programático
   * Também sincroniza lastDetectedPageRef para evitar que detecção de scroll reverta a página
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous' || !state.highlightedPage) return;

    isProgrammaticScrollRef.current = true;
    lastDetectedPageRef.current = state.highlightedPage;
    lastDetectionTimeRef.current = Date.now();

    const pageElement = pageRefs.current.get(state.highlightedPage);
    if (pageElement && scrollContainerRef.current) {
      pageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 400);
  }, [state.highlightedPage, state.viewMode]);

  /**
   * Effect para manter página ativa após rotação
   * Quando uma página é rotacionada, suas dimensões mudam e o cálculo de scroll
   * pode detectar outra página como mais centralizada. Este effect previne isso
   * fazendo scroll de volta para a página alvo após qualquer rotação.
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous' || !state.isRotating || !state.rotationTargetPage) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    const targetPage = state.rotationTargetPage;

    setTimeout(() => {
      const pageElement = pageRefs.current.get(targetPage);
      if (pageElement && scrollContainerRef.current) {
        pageElement.scrollIntoView({ behavior: 'instant', block: 'center' });
      }

      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 400);
    }, 50);
  }, [state.isRotating, state.rotationTargetPage, state.viewMode]);

  const scrollRatioBeforeZoomRef = useRef<number>(0);

  useEffect(() => {
    if (state.viewMode !== 'continuous' || !scrollContainerRef.current) {
      prevZoomRef.current = state.zoom;
      return;
    }

    if (prevZoomRef.current === state.zoom) return;

    const scrollRatio = scrollRatioBeforeZoomRef.current;
    const targetPage = pageBeforeZoomRef.current;

    isProgrammaticScrollRef.current = true;
    lastZoomTimestampRef.current = Date.now();
    zoomBlockedUntilRef.current = Date.now() + 300;

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;

      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      const newScrollTop = scrollRatio * newScrollHeight;
      scrollContainerRef.current.scrollTop = newScrollTop;

      const scrollWidth = scrollContainerRef.current.scrollWidth;
      const clientWidth = scrollContainerRef.current.clientWidth;
      const centerPosition = (scrollWidth - clientWidth) / 2;
      if (centerPosition > 0) {
        scrollContainerRef.current.scrollLeft = centerPosition;
      }

      lastDetectedPageRef.current = targetPage;
      goToPage(targetPage);

      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 100);
    });

    prevZoomRef.current = state.zoom;
  }, [state.zoom, state.viewMode, goToPage]);

  /**
   * Effect para centralizar o scroll horizontal quando o viewer abre
   */
  useEffect(() => {
    if (!state.isOpen || state.isMinimized || !scrollContainerRef.current) return;

    const scrollContainer = scrollContainerRef.current;

    const centerHorizontalScroll = () => {
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      const centerPosition = (scrollWidth - clientWidth) / 2;

      if (centerPosition > 0) {
        scrollContainer.scrollLeft = centerPosition;
      }
    };

    const timeoutId = setTimeout(centerHorizontalScroll, 100);

    return () => clearTimeout(timeoutId);
  }, [state.isOpen, state.isMinimized, state.documents.length]);

  const captureScrollRatioAndZoomIn = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      if (scrollHeight > 0) {
        scrollRatioBeforeZoomRef.current = scrollContainerRef.current.scrollTop / scrollHeight;
      }
    }
    zoomIn();
  }, [zoomIn]);

  const captureScrollRatioAndZoomOut = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      if (scrollHeight > 0) {
        scrollRatioBeforeZoomRef.current = scrollContainerRef.current.scrollTop / scrollHeight;
      }
    }
    zoomOut();
  }, [zoomOut]);

  const captureScrollRatioAndResetZoom = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      if (scrollHeight > 0) {
        scrollRatioBeforeZoomRef.current = scrollContainerRef.current.scrollTop / scrollHeight;
      }
    }
    resetZoom();
  }, [resetZoom]);

  if (!state.isOpen || state.documents.length === 0) {
    return null;
  }

  if (state.isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleMinimize}
          className="flex items-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200"
          title="Expandir visualizador de PDF"
        >
          <FileText size={18} />
          <span className="font-medium">
            {state.documents.length === 1
              ? state.documents[0]?.displayName || 'Documento'
              : `${state.documents.length} Documentos`}
          </span>
          <span className="text-xs opacity-75">({state.currentPage}/{state.totalPages})</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop semi-transparente */}
      <div
        className="fixed inset-0 bg-black bg-opacity-20 z-40"
        onClick={closeViewer}
      />

      {/* Painel principal */}
      <div
        ref={containerRef}
        className="fixed top-0 right-0 bottom-0 bg-white shadow-2xl z-50 flex flex-col notranslate"
        style={{ width: state.panelWidth }}
        translate="no"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {state.documents.length === 1
                ? state.documents[0]?.fileName || 'Documento'
                : `${state.documents.length} Documentos (Visualizador Unificado)`}
            </h3>
            <p className="text-xs text-gray-600">
              Página {state.currentPage} de {state.totalPages} • Zoom: {Math.round(state.zoom * 100)}%
            </p>
          </div>

          {/* Botões de controle do painel */}
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={toggleMinimize}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors duration-200"
              title="Minimizar"
            >
              <span className="text-lg">−</span>
            </button>
            <button
              onClick={closeViewer}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors duration-200"
              title="Fechar"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>

        {/* Barra de ferramentas responsiva */}
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 bg-gray-50 border-b border-gray-200 gap-1 sm:gap-2">
          {/* Lado esquerdo - Índice e Navegação */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Toggle do painel de índice - mais à esquerda */}
            <button
              onClick={toggleBookmarkPanel}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium border rounded transition-colors duration-200 ${
                state.isBookmarkPanelVisible
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title={state.isBookmarkPanelVisible ? 'Ocultar Índice' : 'Mostrar Índice'}
            >
              <BookOpen size={14} />
              {responsiveConfig.showToolbarLabels && <span>Índice</span>}
              {state.bookmarks.length > 0 && (
                <span className="px-1 py-0.5 text-xs bg-gray-200 rounded-full min-w-[18px] text-center">
                  {state.bookmarks.length}
                </span>
              )}
            </button>

            {/* Separador */}
            <div className="w-px h-6 bg-gray-300 hidden sm:block" />

            {/* Navegação de páginas */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePreviousPage}
                disabled={state.currentPage <= 1 || state.isRotating}
                className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title="Página anterior"
              >
                ←
              </button>

              <input
                type="number"
                value={pageInputValue || state.currentPage}
                onChange={(e) => setPageInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (state.isRotating) return;
                    const page = parseInt(pageInputValue) || state.currentPage;
                    handleManualPageNavigation(page);
                    setPageInputValue('');
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onBlur={() => setPageInputValue('')}
                onFocus={(e) => {
                  setPageInputValue(String(state.currentPage));
                  e.target.select();
                }}
                className="w-12 sm:w-14 px-1 sm:px-2 py-1 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                max={state.totalPages}
              />

              <button
                onClick={handleNextPage}
                disabled={state.currentPage >= state.totalPages || state.isRotating}
                className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title="Próxima página"
              >
                →
              </button>
            </div>
          </div>

          {/* Grupo de controles - lado direito */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Controles de zoom e ferramentas */}
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 overflow-visible">
              {/* Controles de zoom */}
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button
                  onClick={captureScrollRatioAndZoomOut}
                  className="px-2 sm:px-3 py-1 text-xs font-medium text-blue-600 bg-white hover:bg-gray-50 transition-colors duration-200 border-r border-gray-300"
                  title="Diminuir zoom"
                >
                  −
                </button>
                <button
                  onClick={captureScrollRatioAndResetZoom}
                  className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 min-w-[50px]"
                  title="Resetar zoom"
                >
                  {Math.round(state.zoom * 100)}%
                </button>
                <button
                  onClick={captureScrollRatioAndZoomIn}
                  className="px-2 sm:px-3 py-1 text-xs font-medium text-blue-600 bg-white hover:bg-gray-50 transition-colors duration-200 border-l border-gray-300"
                  title="Aumentar zoom"
                >
                  +
                </button>
              </div>

              {/* Separador */}
              <div className="w-px h-6 bg-gray-300 hidden sm:block" />

            {/* Search button */}
            <button
              onClick={toggleSearch}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium border rounded transition-colors duration-200 ${
                state.isSearchOpen
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Pesquisar (Ctrl+F)"
            >
              <Search size={14} />
              {responsiveConfig.showToolbarLabels && <span>Buscar</span>}
            </button>

            {/* Ferramentas principais - visíveis em telas normais */}
            {!responsiveConfig.toolbarCompact && (
              <>
                {/* Separador */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Highlighter tool */}
                <div className="relative">
                  <button
                    onClick={() => {
                      toggleHighlighter();
                      if (!state.isHighlighterActive) {
                        setShowColorPicker(true);
                      }
                    }}
                    className={`flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium border rounded transition-colors duration-200 ${
                      state.isHighlighterActive
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title={state.isHighlighterActive ? 'Desativar Destacador' : 'Ativar Destacador'}
                  >
                    <Highlighter size={14} />
                    {responsiveConfig.showToolbarLabels && <span>Destacar</span>}
                  </button>

                  {/* Color picker dropdown */}
                  {showColorPicker && state.isHighlighterActive && (
                    <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50">
                      <div className="text-xs text-gray-600 font-medium mb-2 px-1">Cor do destaque:</div>
                      <div className="flex gap-2">
                        {HIGHLIGHT_COLORS.map((color) => {
                          const colorConfig = HIGHLIGHT_COLOR_CONFIG[color];
                          const isSelected = state.selectedHighlightColor === color;
                          return (
                            <button
                              key={color}
                              onClick={() => {
                                setSelectedHighlightColor(color);
                                setShowColorPicker(false);
                              }}
                              className={`w-7 h-7 rounded ${colorConfig.bg} ${colorConfig.border} border-2 hover:scale-110 transition-transform ${
                                isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                              }`}
                              title={color}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Comment mode tool */}
                <div className="relative">
                  <button
                    onClick={() => {
                      toggleCommentMode();
                      if (!state.isCommentModeActive) {
                        setShowCommentColorPicker(true);
                      }
                    }}
                    className={`flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium border rounded transition-colors duration-200 ${
                      state.isCommentModeActive
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title={state.isCommentModeActive ? 'Desativar Comentarios' : 'Adicionar Comentario'}
                  >
                    <MessageCircle size={14} />
                    {responsiveConfig.showToolbarLabels && <span>Comentar</span>}
                  </button>

                  {/* Comment color picker dropdown */}
                  {showCommentColorPicker && state.isCommentModeActive && (
                    <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50">
                      <div className="text-xs text-gray-600 font-medium mb-2 px-1">Cor do comentario:</div>
                      <div className="flex gap-2">
                        {(Object.keys(COMMENT_COLORS) as CommentColor[]).map((color) => {
                          const colorConfig = COMMENT_COLORS[color];
                          const isSelected = state.selectedCommentColor === color;
                          return (
                            <button
                              key={color}
                              onClick={() => {
                                setSelectedCommentColor(color);
                                setShowCommentColorPicker(false);
                              }}
                              className={`w-7 h-7 rounded ${colorConfig.bg} ${colorConfig.border} border-2 hover:scale-110 transition-transform ${
                                isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                              }`}
                              title={color}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Separador */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Rotation controls */}
                <RotationControls
                  currentPage={state.currentPage}
                  totalPages={state.totalPages}
                />

                {/* Separador */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Extract pages button */}
                <button
                  onClick={openPageExtractionModal}
                  disabled={state.documents.length === 0}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Extrair Paginas"
                >
                  <FileOutput size={14} />
                  {responsiveConfig.showToolbarLabels && <span>Extrair</span>}
                </button>

                {/* Separador */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Toggle de modo de visualização */}
                <button
                  onClick={handleToggleViewMode}
                  className={`flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium border rounded transition-colors duration-200 ${
                    state.viewMode === 'continuous'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={state.viewMode === 'continuous' ? 'Modo Contínuo' : 'Modo Paginado'}
                >
                  {state.viewMode === 'continuous' ? (
                    <>
                      <Columns size={14} />
                      {responsiveConfig.showToolbarLabels && <span>Contínuo</span>}
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      {responsiveConfig.showToolbarLabels && <span>Paginado</span>}
                    </>
                  )}
                </button>
              </>
            )}

            {/* Menu overflow para telas compactas */}
            {responsiveConfig.toolbarCompact && (
              <div className="relative" data-toolbar-overflow>
                <button
                  onClick={() => setShowToolbarOverflow(!showToolbarOverflow)}
                  className="flex items-center space-x-1 px-2 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors duration-200"
                  title="Mais opções"
                >
                  <MoreVertical size={14} />
                  <ChevronDown size={12} />
                </button>

                {showToolbarOverflow && (
                  <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[180px]">
                    {/* Highlighter */}
                    <button
                      onClick={() => {
                        toggleHighlighter();
                        if (!state.isHighlighterActive) {
                          setShowColorPicker(true);
                        }
                        setShowToolbarOverflow(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 text-sm ${
                        state.isHighlighterActive
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Highlighter size={14} />
                      <span>Destacar</span>
                    </button>

                    {/* Color picker inline */}
                    {state.isHighlighterActive && (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <div className="text-xs text-gray-600 mb-2">Cor:</div>
                        <div className="flex gap-2">
                          {HIGHLIGHT_COLORS.map((color) => {
                            const colorConfig = HIGHLIGHT_COLOR_CONFIG[color];
                            const isSelected = state.selectedHighlightColor === color;
                            return (
                              <button
                                key={color}
                                onClick={() => setSelectedHighlightColor(color)}
                                className={`w-6 h-6 rounded ${colorConfig.bg} ${colorConfig.border} border-2 hover:scale-110 transition-transform ${
                                  isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                                }`}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-100 my-1" />

                    {/* Rotation controls inline */}
                    <div className="px-3 py-2">
                      <RotationControls
                        currentPage={state.currentPage}
                        totalPages={state.totalPages}
                      />
                    </div>

                    <div className="border-t border-gray-100 my-1" />

                    {/* Extract */}
                    <button
                      onClick={() => {
                        openPageExtractionModal();
                        setShowToolbarOverflow(false);
                      }}
                      disabled={state.documents.length === 0}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FileOutput size={14} />
                      <span>Extrair Páginas</span>
                    </button>

                    <div className="border-t border-gray-100 my-1" />

                    {/* View mode */}
                    <button
                      onClick={() => {
                        handleToggleViewMode();
                        setShowToolbarOverflow(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 text-sm ${
                        state.viewMode === 'continuous'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {state.viewMode === 'continuous' ? (
                        <>
                          <Columns size={14} />
                          <span>Modo Contínuo</span>
                        </>
                      ) : (
                        <>
                          <FileText size={14} />
                          <span>Modo Paginado</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggle do sidebar */}
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={toggleSidebar}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs font-medium border rounded transition-colors duration-200 ${
                state.isSidebarVisible
                  ? 'bg-teal-50 text-teal-700 border-teal-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title={state.isSidebarVisible ? 'Ocultar Painel' : 'Mostrar Painel'}
            >
              {state.isSidebarVisible ? (
                <PanelRightClose size={14} />
              ) : (
                <PanelRight size={14} />
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Layout: Bookmark Panel (left) + PDF (center) + Sidebar (right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Bookmark Panel - Left Side (Responsivo) */}
          <div
            className={`transition-all duration-300 ease-in-out border-r border-gray-300 bg-white overflow-hidden ${
              state.isBookmarkPanelVisible ? 'opacity-100' : 'opacity-0 w-0'
            }`}
            style={{
              width: state.isBookmarkPanelVisible ? `${responsiveConfig.bookmarkPanelWidth}px` : '0px'
            }}
          >
            <PDFBookmarkPanel />
          </div>

          {/* PDF Area */}
          <div className="flex-1 relative overflow-hidden">
            <PDFSearchPopup
              processId={processId}
              documentOffsets={memoizedDocumentOffsets}
            />
            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-auto bg-gray-200"
              style={{ visibility: isModeTransitioning ? 'hidden' : 'visible' }}
            >
              <div className="flex justify-center py-4">
                <div className="flex flex-col items-center space-y-4">
              {state.documents.map((doc, docIndex) => {
                const numPages = documentPages.get(doc.id) || 0;
                const offset = memoizedDocumentOffsets.get(doc.id);

                if (state.viewMode === 'paginated') {
                  const pageInfo = findDocumentByGlobalPage(state.currentPage);
                  if (!pageInfo || pageInfo.document.id !== doc.id) {
                    return null;
                  }
                }

                return (
                  <div key={doc.id} className="flex flex-col items-center">
                    {docIndex > 0 && state.viewMode === 'continuous' && (
                      <div className="max-w-4xl mb-4 bg-white border-l-4 border-blue-400 rounded shadow-sm p-2.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="text-xs font-semibold text-gray-700 truncate">
                            {doc.displayName}
                          </div>
                        </div>
                      </div>
                    )}

                    <Document
                      file={doc.url}
                      onLoadSuccess={(pdf) => onDocumentLoadSuccess(pdf, docIndex)}
                      onLoadError={onDocumentLoadError}
                      onItemClick={onItemClick}
                      loading={
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                          <p className="text-gray-600 text-sm">Carregando {doc.displayName}...</p>
                        </div>
                      }
                      error={
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-2xl">
                          <p className="text-red-800 font-medium mb-3">Erro ao carregar {doc.displayName}</p>
                          <p className="text-red-600 text-sm mb-3">Verifique se o arquivo está acessível</p>
                          <div className="text-left bg-white rounded p-3 text-xs text-gray-700">
                            <p className="font-semibold mb-2">Possíveis causas:</p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>Bucket do Supabase não está público</li>
                              <li>Arquivo foi removido do storage</li>
                              <li>Políticas de RLS bloqueando acesso</li>
                              <li>Problema de conectividade</li>
                            </ul>
                            <p className="mt-3 font-semibold">URL do arquivo:</p>
                            <p className="text-xs break-all text-gray-600">{doc.url || 'N/A'}</p>
                          </div>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                          >
                            Recarregar Página
                          </button>
                        </div>
                      }
                    >
                      {state.viewMode === 'paginated' ? (
                        // Modo Paginado: Renderiza apenas a página que pertence a este documento
                        (() => {
                          const pageInfo = findDocumentByGlobalPage(state.currentPage);

                          // Se a página atual não pertence a este documento, não renderiza nada
                          if (!pageInfo || pageInfo.document.id !== doc.id) {
                            return null;
                          }

                          return (
                            <div
                              className="relative"
                              data-global-page={state.currentPage}
                              style={{
                                width: getPageWidth(state.currentPage),
                                height: getPageHeight(state.currentPage)
                              }}
                            >
                              <MemoizedPDFPage
                                pageNumber={pageInfo.localPage}
                                scale={state.zoom}
                                displayScale={state.displayZoom}
                                userRotation={getPageRotation(state.currentPage)}
                                internalRotation={state.pageDimensions.get(state.currentPage)?.internalRotation || 0}
                                loading={
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                  </div>
                                }
                                className="shadow-lg"
                                wrapperClassName="relative"
                                renderTextLayer={true}
                                renderAnnotationLayer={!state.performanceMode.disableAnnotations}
                                isInteracting={state.isInteracting && !state.isSearchOpen}
                              >
                              <HighlightLayer pageNumber={state.currentPage} scale={state.displayZoom} />
                              <CommentLayer
                                pageNumber={state.currentPage}
                                scale={state.displayZoom}
                                pageWidth={getPageWidth(state.currentPage) / state.zoom}
                                pageHeight={getPageHeight(state.currentPage) / state.zoom}
                                processDocumentId={doc.id}
                              />
                              <PDFSearchHighlightLayer
                                pageNumber={state.currentPage}
                                scale={state.displayZoom}
                                documentId={doc.id}
                                localPageNumber={pageInfo.localPage}
                                searchResults={state.searchResults}
                                currentSearchIndex={state.currentSearchIndex}
                                  searchQuery={state.searchQuery}
                                />
                                <SelectionOverlay
                                  pageNumber={state.currentPage}
                                  rects={selectionsByPage.get(state.currentPage) || []}
                                />
                              </MemoizedPDFPage>
                            </div>
                          );
                        })()
                      ) : (
                        // Modo Contínuo Ultra-Performance: Renderização Mínima
                        (() => {
                          // Se o documento ainda não carregou, não renderiza páginas
                          if (numPages === 0 || !offset) {
                            return null;
                          }

                          return (
                            <div className="flex flex-col items-center space-y-4">
                              {Array.from({ length: numPages }, (_, i) => i + 1).map((localPageNum) => {
                                const globalPageNum = offset.startPage + localPageNum - 1;
                                const shouldRenderCanvas = pagesToRender.has(globalPageNum);

                                const pageHeight = getPageHeight(globalPageNum);
                                const pageWidth = getPageWidth(globalPageNum);

                                return (
                                  <div
                                    key={globalPageNum}
                                    ref={(el) => {
                                      if (el) {
                                        pageRefs.current.set(globalPageNum, el);
                                      } else {
                                        pageRefs.current.delete(globalPageNum);
                                      }
                                    }}
                                    data-global-page={globalPageNum}
                                    className="relative flex items-center justify-center"
                                  >
                                    {shouldRenderCanvas ? (
                                      <>
                                        <MemoizedPDFPage
                                            pageNumber={localPageNum}
                                            scale={state.zoom}
                                            displayScale={state.displayZoom}
                                            userRotation={getPageRotation(globalPageNum)}
                                            internalRotation={state.pageDimensions.get(globalPageNum)?.internalRotation || 0}
                                            onLoadSuccess={(page) => onPageLoadSuccess(page, globalPageNum)}
                                            loading={
                                              <div
                                                className="flex items-center justify-center bg-white shadow-lg"
                                                style={{ height: `${pageHeight}px`, width: `${pageWidth}px` }}
                                              >
                                                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                              </div>
                                            }
                                            className="shadow-lg"
                                            wrapperClassName="relative"
                                            renderTextLayer={true}
                                            renderAnnotationLayer={!state.performanceMode.disableAnnotations}
                                            isInteracting={state.isInteracting && !state.isSearchOpen}
                                          >
                                        <HighlightLayer pageNumber={globalPageNum} scale={state.displayZoom} />
                                        <CommentLayer
                                          pageNumber={globalPageNum}
                                          scale={state.displayZoom}
                                          pageWidth={pageWidth / state.zoom}
                                          pageHeight={pageHeight / state.zoom}
                                          processDocumentId={doc.id}
                                        />
                                        <PDFSearchHighlightLayer
                                          pageNumber={globalPageNum}
                                          scale={state.displayZoom}
                                          documentId={doc.id}
                                          localPageNumber={localPageNum}
                                          searchResults={state.searchResults}
                                          currentSearchIndex={state.currentSearchIndex}
                                              searchQuery={state.searchQuery}
                                            />
                                            <SelectionOverlay
                                              pageNumber={globalPageNum}
                                              rects={selectionsByPage.get(globalPageNum) || []}
                                            />
                                          </MemoizedPDFPage>
                                      </>
                                    ) : (
                                      // Placeholder ultra-leve para páginas não renderizadas
                                      <div
                                        className="bg-white shadow-lg flex items-center justify-center border border-gray-200"
                                        style={{ height: `${pageHeight}px`, width: `${pageWidth}px` }}
                                      >
                                        <div className="text-gray-300 text-xs">
                                          Página {globalPageNum}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      )}
                    </Document>
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Area - Responsivo */}
          <div
            className={`border-l border-gray-300 bg-gray-50 transition-all duration-300 ease-in-out overflow-hidden ${
              state.isSidebarVisible ? 'opacity-100' : 'opacity-0 w-0'
            }`}
            style={{
              width: state.isSidebarVisible ? `${responsiveConfig.sidebarWidth}px` : '0px'
            }}
          >
            {processId ? (
              <PDFSidebar processId={processId} />
            ) : (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center text-gray-500">
                  <FileText className="mx-auto mb-3 text-gray-400" size={48} />
                  <p className="text-sm">Abra um documento de processo para gerenciar registros</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popup de seleção de texto */}
      {state.selectedText && state.selectionPosition && (
        <TextSelectionPopup
          selectedText={state.selectedText}
          position={state.selectionPosition}
          onCopy={handleCopyText}
          onHighlight={handleCreateHighlight}
          onInsertFundamentacao={() => handleInsertInField('fundamentacao')}
          onInsertComentarios={() => handleInsertInField(getCommentFieldForCurrentMode())}
          onClose={clearSelection}
          containerRef={scrollContainerRef}
          hasActiveForm={state.formMode !== 'view'}
          hasFundamentacaoField={state.formMode === 'create-verba' || state.formMode === 'edit-verba'}
        />
      )}

      {/* Modal de rotação de intervalo de páginas */}
      <PageRangeRotationModal totalPages={state.totalPages} />

      {/* Modal de extração de páginas */}
      {getCurrentDocument() && (
        <PageExtractionModal
          isOpen={state.isPageExtractionModalOpen}
          onClose={closePageExtractionModal}
          documentUrl={getCurrentDocument()?.url || ''}
          documentName={getCurrentDocument()?.displayName || 'documento.pdf'}
          totalPages={state.totalPages}
        />
      )}
    </>
  );
};

export default React.memo(FloatingPDFViewer);
