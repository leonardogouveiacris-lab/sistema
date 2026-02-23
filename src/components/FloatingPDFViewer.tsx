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
 * - RENDERIZAÇÃO EXPANDIDA: orçamento explícito com limite total de páginas
 * - PRELOAD IMEDIATO: páginas vizinhas dentro de CONTINUOUS_PRELOAD_RADIUS
 * - IDLE PRELOAD SECUNDÁRIO: faixa adicional até CONTINUOUS_IDLE_PRELOAD_RADIUS via requestIdleCallback
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
import { COMMENT_COLORS, CommentColor, PDFComment } from '../types/PDFComment';
import * as PDFCommentsService from '../services/pdfComments.service';
import { useSelectionOverlay } from '../hooks/useSelectionOverlay';
import logger from '../utils/logger';
import { formatPDFText, extractTextFromSelection } from '../utils/textFormatter';
import * as HighlightsService from '../services/highlights.service';
const lazyExtractAllPagesText = () => import('../utils/pdfTextExtractor').then(m => m.extractAllPagesText);
import {
  generatePDFCacheKey,
  saveBookmarksToCache,
  loadBookmarksFromCache,
  clearOldBookmarkCaches
} from '../utils/performance';
import type { DocumentInfo } from '../utils/pdfBookmarkExtractor';
import { countTotalBookmarks, mergeBookmarksFromMultipleDocuments } from '../utils/pdfBookmarkExtractor';

const lazyExtractBookmarks = () => import('../utils/pdfBookmarkExtractor').then(m => m.extractBookmarksWithDocumentInfo);
import { mergeRectsIntoLines } from '../utils/rectMerger';
import { findFirstIndexByBottom, findLastIndexByTop } from '../utils/pageVisibilityIndex';

// Configurar worker do PDF.js usando arquivo local
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const PDF_DOCUMENT_OPTIONS = {
  wasmUrl: '/wasm/',
  isEvalSupported: false,
  cMapPacked: true,
  disableAutoFetch: true,
  disableStream: false,
  enableXfa: false,
  disableRange: false,
};

const BOOKMARKS_IDLE_TIMEOUT_MS = 1000;
const COMMENTS_BATCH_DELAY_MS = 120;
const HEAVY_TASK_CONCURRENCY = 2;
const CONTINUOUS_WINDOW_BUFFER_PAGES = 3;
const CONTINUOUS_RENDER_BUDGET_PAGES = 12;
const CONTINUOUS_INACTIVE_DOCUMENT_RENDER_BUDGET_PAGES = 2;
const DEBUG_CONTINUOUS_RENDER = false;
const CONTINUOUS_PRELOAD_RADIUS = 2;
const CONTINUOUS_IDLE_PRELOAD_RADIUS = 4;
const CONTINUOUS_PAGE_GAP_PX = 16;
const PROGRAMMATIC_SCROLL_RETRY_TIMEOUT_MS = 8000;
const PROGRAMMATIC_SCROLL_RELEASE_DELAY_MS = 400;
const PROGRAMMATIC_SCROLL_SAFETY_TIMEOUT_MS = 9000;
const ZOOM_POST_RECONCILIATION_TIMEOUT_MS = 240;
const ZOOM_POST_BLOCK_DURATION_MS = 120;
const ZOOM_POST_BLOCK_SMALL_DIVERGENCE_PAGES = 2;
const KEYBOARD_NAV_LOCK_DURATION_MS = 650;
const KEYBOARD_NAV_SETTLE_DURATION_MS = 120;
const KEYBOARD_NAV_COOLDOWN_DURATION_MS = 700;
const KEYBOARD_NAV_TARGET_STABLE_FRAMES = 3;
const DOCUMENT_MOUNT_HYSTERESIS_TTL_MS = 3200;
const DOCUMENT_REMOUNT_RECONCILIATION_BLOCK_MS = 900;
const DOCUMENT_REMOUNT_CENTER_FREEZE_MS = 1200;
const REMOUNT_ANOMALOUS_PAGE_DELTA = 4;
const RECENT_NAVIGATION_WINDOW_MS = 2200;
const TEXT_SELECTION_STALE_RESET_MS = 2500;
const DRAG_SCROLL_BLOCK_WINDOW_MS = 400;
const POINTER_DOWN_SAFETY_RESET_MS = 450;
const TEXT_SELECTION_SAFETY_RESET_MS = 450;
const EMPTY_VISIBLE_PAGES_SCROLL_FRAME_THRESHOLD = 4;
const SCROLL_ACTIVITY_IDLE_TIMEOUT_MS = 160;
const CURRENT_PAGE_VISIBLE_DIVERGENCE_THRESHOLD_PAGES = 3;
const FORCED_RECONCILIATION_DIVERGENCE_DURATION_MS = 500;


type HeavyTaskType = 'comments' | 'bookmarks';

interface HeavyDocumentTask {
  id: string;
  type: HeavyTaskType;
  documentId: string;
  priority: number;
  enqueuedAt: number;
  controller: AbortController;
  generation: number;
  run: (signal: AbortSignal) => Promise<void>;
}

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
    setBookmarkStatusByDoc,
    resetBookmarksStatusByDoc,
    setIsLoadingBookmarks,
    setBookmarksError,
    toggleBookmarkPanel,
    setPageDimensionsBatch,
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
  const [scrollFallbackVisibleRange, setScrollFallbackVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const [scrollRenderCache, setScrollRenderCache] = useState<Set<number>>(new Set());
  const [pageInputValue, setPageInputValue] = useState<string>('');
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const isSelectingTextRef = useRef(false);
  const isPointerDownInPdfRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const dragScrollBlockUntilRef = useRef<number>(0);
  const pointerDownSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textSelectionSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startedInsidePdfRef = useRef(false);
  const hasDragRef = useRef(false);
  const activeCaretElementRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainerElement, setScrollContainerElement] = useState<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRenderCacheRecencyQueueRef = useRef<number[]>([]);
  const lastDetectedPageRef = useRef<number>(1);
  const lastDetectionTimeRef = useRef<number>(0);
  const idleCallbackIdRef = useRef<number | null>(null);
  const renderFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollThrottleRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);
  const scrollReconciliationRafRef = useRef<number | null>(null);
  const scrollReconciliationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollDivergenceStartedAtRef = useRef<number | null>(null);
  const scrollDivergenceLastLogAtRef = useRef<number>(0);
  const currentPageVisibleDivergenceStartedAtRef = useRef<number | null>(null);
  const currentPageVisibleDivergenceLastLogAtRef = useRef<number>(0);
  const forcedReconciliationDivergenceStartedAtRef = useRef<number | null>(null);
  const emptyVisiblePagesScrollFramesRef = useRef<number>(0);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollIdleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevZoomRef = useRef<number>(state.zoom);
  const prevDisplayZoomRef = useRef<number>(state.displayZoom);
  const isZoomChangingRef = useRef(false);
  const lastZoomTimestampRef = useRef<number>(0);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textSelectionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const handlePreviousPageRef = useRef<() => void>(() => {});
  const handleNextPageRef = useRef<() => void>(() => {});
  const handleManualPageNavigationRef = useRef<(pageNum: number) => void>(() => {});
  const toggleSearchRef = useRef<() => void>(() => {});
  const totalPagesRef = useRef<number>(state.totalPages);
  const keyboardNavigationThrottleMsRef = useRef<number>(state.viewMode === 'continuous' ? 90 : 130);
  const keyboardNavigationLastTimeRef = useRef<number>(0);
  const keyboardNavTargetPageRef = useRef<number | null>(null);
  const keyboardNavRecentTargetPageRef = useRef<number | null>(null);
  const keyboardNavLockUntilRef = useRef<number>(0);
  const keyboardNavTargetReachedAtRef = useRef<number | null>(null);
  const keyboardNavLastInputAtRef = useRef<number>(0);
  const keyboardNavCooldownUntilRef = useRef<number>(0);
  const keyboardNavStableFramesRef = useRef<number>(0);
  const currentPageRef = useRef<number>(state.currentPage);
  const calculateVisiblePagesFromScrollRef = useRef<(options?: { allowLargeJump?: boolean; previousScrollTop?: number }) => void>(() => {});
  const estimateCenterPageFromScrollRef = useRef<(scrollTop: number, viewportHeight: number) => number>(() => 1);
  const markInteractionStartRef = useRef<() => void>(() => {});
  const initialScrollRecalcRafRef = useRef<number | null>(null);
  const initialScrollRecalcRafNestedRef = useRef<number | null>(null);
  const initialScrollRecalcTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const documentMountLastSeenAtRef = useRef<Map<string, number>>(new Map());
  const documentConfirmedHeightsRef = useRef<Map<string, number>>(new Map());
  const previouslyMountedDocumentsRef = useRef<Set<string>>(new Set());
  const offsetRebuildBlockUntilRef = useRef<number>(0);
  const centerPageFreezeUntilRef = useRef<number>(0);

  const zoomBlockedUntilRef = useRef<number>(0);
  const zoomAnchorRef = useRef<{ page: number; relativeOffsetY: number; hasMeasuredPage: boolean } | null>(null);
  const visibleStartPageRef = useRef<number>(1);
  const visibleEndPageRef = useRef<number>(1);
  const textExtractionProgressRef = useRef<Map<string, { current: number; total: number }>>(new Map());
  const textExtractionAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const highlightedPageRef = useRef<number | null>(state.highlightedPage);
  const pendingNavigationTargetRef = useRef<{ page: number; source: 'highlight' | 'manual' | 'search'; startedAt: number } | null>(null);
  const isModeSwitchingRef = useRef(false);
  const textSelectionActivatedAtRef = useRef<number | null>(null);
  const pageBeforeModeSwitchRef = useRef<number>(state.currentPage);
  const prevViewModeRef = useRef<'continuous' | 'paginated'>(state.viewMode);
  const hasMountedRef = useRef(false);
  const phaseTimersRef = useRef<Map<string, number>>(new Map());
  const criticalDocStartTimesRef = useRef<Map<string, number>>(new Map());
  const firstPaintRecordedRef = useRef(false);
  const commentsLoadStartedRef = useRef(false);
  const commentsLoadedDocsRef = useRef<Set<string>>(new Set());
  const commentsLoadInFlightRef = useRef<Set<string>>(new Set());
  const commentsByDocumentRef = useRef<Map<string, PDFComment[]>>(new Map());
  const bookmarkExtractionInFlightRef = useRef<Set<string>>(new Set());
  const bookmarkExtractionLoadedRef = useRef<Set<string>>(new Set());
  const bookmarkExtractionFailedRef = useRef<Set<string>>(new Set());
  const loadedDocumentRefsByGenerationRef = useRef<Set<string>>(new Set());
  const proxyGenerationByDocumentRef = useRef<Map<string, number>>(new Map());
  const documentSetGenerationRef = useRef(0);
  const lastOpenDocumentSetSignatureRef = useRef<string | null>(null);
  const commentsBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageDimensionsUpdateQueueRef = useRef<Map<number, { width: number; height: number; internalRotation?: number }>>(new Map());
  const pageDimensionsBatchFrameRef = useRef<number | null>(null);
  const heavyTaskQueueRef = useRef<HeavyDocumentTask[]>([]);
  const heavyTaskInFlightRef = useRef<Map<string, HeavyDocumentTask>>(new Map());
  const heavyTaskGenerationRef = useRef(0);
  const heavyTaskMetricsRef = useRef({
    enqueued: 0,
    started: 0,
    completed: 0,
    cancelled: 0,
    totalWaitMs: 0,
    totalRunMs: 0,
    maxBacklog: 0
  });
  const INTERACTION_DEBOUNCE_MS = 500;
  const ZOOM_PROTECTION_DURATION_MS = 500;
  const MAX_PAGE_JUMP = 30;
  const documentSetSignature = useMemo(() => state.documents.map(doc => doc.id).join('|'), [state.documents]);
  const topLevelBookmarkCount = state.bookmarks.length;
  const totalBookmarkCount = useMemo(() => countTotalBookmarks(state.bookmarks), [state.bookmarks]);
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

  const startPhaseTimer = useCallback((phase: string) => {
    phaseTimersRef.current.set(phase, performance.now());
  }, []);

  const flushPageDimensionUpdates = useCallback(() => {
    pageDimensionsBatchFrameRef.current = null;

    if (pageDimensionsUpdateQueueRef.current.size === 0) {
      return;
    }

    const entries = Array.from(pageDimensionsUpdateQueueRef.current.entries());
    pageDimensionsUpdateQueueRef.current.clear();
    setPageDimensionsBatch(entries);
  }, [setPageDimensionsBatch]);

  useEffect(() => {
    return () => {
      if (pageDimensionsBatchFrameRef.current !== null) {
        window.cancelAnimationFrame(pageDimensionsBatchFrameRef.current);
        pageDimensionsBatchFrameRef.current = null;
      }

      pageDimensionsUpdateQueueRef.current.clear();
    };
  }, []);

  const finishPhaseTimer = useCallback((phase: string, context: string, data?: Record<string, unknown>) => {
    const start = phaseTimersRef.current.get(phase);
    if (start === undefined) return;
    const durationMs = performance.now() - start;
    logger.info(
      `Fase "${phase}" concluída em ${durationMs.toFixed(2)}ms`,
      context,
      data ? { ...data, durationMs } : { durationMs }
    );
    phaseTimersRef.current.delete(phase);
  }, []);

  const scheduleIdleTask = useCallback((task: () => void, timeout = BOOKMARKS_IDLE_TIMEOUT_MS): (() => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(task, { timeout });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(task, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const logHeavyTaskMetrics = useCallback((reason: string) => {
    const metrics = heavyTaskMetricsRef.current;
    const completed = Math.max(metrics.completed, 1);
    logger.info(
      'Métricas do orquestrador de tarefas pesadas',
      'FloatingPDFViewer.heavyTaskQueue',
      {
        reason,
        inFlight: heavyTaskInFlightRef.current.size,
        queued: heavyTaskQueueRef.current.length,
        enqueued: metrics.enqueued,
        started: metrics.started,
        completed: metrics.completed,
        cancelled: metrics.cancelled,
        maxBacklog: metrics.maxBacklog,
        avgWaitMs: Number((metrics.totalWaitMs / completed).toFixed(2)),
        avgRunMs: Number((metrics.totalRunMs / completed).toFixed(2))
      }
    );
  }, []);

  const cancelHeavyTasks = useCallback((reason: string) => {
    const pending = heavyTaskQueueRef.current.length;
    const running = heavyTaskInFlightRef.current.size;

    if (pending === 0 && running === 0) {
      return;
    }

    heavyTaskMetricsRef.current.cancelled += pending + running;

    heavyTaskQueueRef.current.forEach(task => {
      task.controller.abort();
    });

    heavyTaskInFlightRef.current.forEach(task => {
      task.controller.abort();
    });

    heavyTaskQueueRef.current = [];
    heavyTaskInFlightRef.current.clear();

    logHeavyTaskMetrics(reason);
  }, [logHeavyTaskMetrics]);

  const processHeavyTaskQueue = useCallback(() => {
    if (heavyTaskQueueRef.current.length > 1) {
      heavyTaskQueueRef.current.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.enqueuedAt - b.enqueuedAt;
      });
    }

    while (
      heavyTaskInFlightRef.current.size < HEAVY_TASK_CONCURRENCY &&
      heavyTaskQueueRef.current.length > 0
    ) {
      const nextTask = heavyTaskQueueRef.current.shift();
      if (!nextTask || nextTask.controller.signal.aborted || nextTask.generation !== heavyTaskGenerationRef.current) {
        continue;
      }

      const startedAt = performance.now();
      heavyTaskMetricsRef.current.started += 1;
      heavyTaskMetricsRef.current.totalWaitMs += startedAt - nextTask.enqueuedAt;
      heavyTaskInFlightRef.current.set(nextTask.id, nextTask);

      void nextTask.run(nextTask.controller.signal)
        .catch(error => {
          if (nextTask.controller.signal.aborted) {
            return;
          }
          logger.warn(
            'Falha ao executar tarefa pesada',
            'FloatingPDFViewer.heavyTaskQueue',
            { taskId: nextTask.id, type: nextTask.type, documentId: nextTask.documentId, error }
          );
        })
        .finally(() => {
          heavyTaskInFlightRef.current.delete(nextTask.id);
          if (!nextTask.controller.signal.aborted) {
            heavyTaskMetricsRef.current.completed += 1;
            heavyTaskMetricsRef.current.totalRunMs += performance.now() - startedAt;
          }

          if (heavyTaskQueueRef.current.length === 0 && heavyTaskInFlightRef.current.size === 0) {
            logHeavyTaskMetrics('queue-drained');
          }

          processHeavyTaskQueue();
        });
    }
  }, [logHeavyTaskMetrics]);

  const enqueueHeavyTask = useCallback((task: Omit<HeavyDocumentTask, 'enqueuedAt' | 'controller' | 'generation'>) => {
    const existsInQueue = heavyTaskQueueRef.current.some(existing => existing.id === task.id);
    const existsInFlight = heavyTaskInFlightRef.current.has(task.id);

    if (existsInQueue || existsInFlight) {
      return;
    }

    const heavyTask: HeavyDocumentTask = {
      ...task,
      generation: heavyTaskGenerationRef.current,
      enqueuedAt: performance.now(),
      controller: new AbortController()
    };

    heavyTaskQueueRef.current.push(heavyTask);
    heavyTaskMetricsRef.current.enqueued += 1;
    heavyTaskMetricsRef.current.maxBacklog = Math.max(
      heavyTaskMetricsRef.current.maxBacklog,
      heavyTaskQueueRef.current.length + heavyTaskInFlightRef.current.size
    );

    processHeavyTaskQueue();
  }, [processHeavyTaskQueue]);

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

  const {
    selectionsByPage,
    hasSelection,
    selectionMode,
    canWriteProgrammaticSelection,
    applySelectionSafely,
    registerContextCommit,
    clearSelection: clearSelectionOverlay
  } = useSelectionOverlay(scrollContainerRef);

  /**
   * Effect para limpar caches antigos de bookmarks na montagem
   */
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => clearOldBookmarkCaches());
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => clearOldBookmarkCaches(), 2000);
    return () => clearTimeout(id);
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

  const deriveVisibleRangeFromContainer = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || state.totalPages <= 0 || cumulativePageBottoms.length === 0 || cumulativePageTops.length === 0) {
      return null;
    }

    const viewportStart = container.scrollTop;
    const viewportEnd = viewportStart + container.clientHeight;

    const fallbackStartIndex = Math.max(0, findFirstIndexByBottom(cumulativePageBottoms, viewportStart));
    const fallbackEndIndex = Math.min(
      cumulativePageTops.length - 1,
      findLastIndexByTop(cumulativePageTops, viewportEnd)
    );

    if (fallbackStartIndex <= fallbackEndIndex) {
      return {
        start: fallbackStartIndex + 1,
        end: fallbackEndIndex + 1
      };
    }

    const viewportCenter = viewportStart + container.clientHeight / 2;
    const centerIndex = findFirstIndexByBottom(cumulativePageBottoms, viewportCenter);
    const centerPage = Math.min(
      state.totalPages,
      Math.max(1, centerIndex >= state.totalPages ? state.totalPages : centerIndex + 1)
    );

    return {
      start: centerPage,
      end: centerPage
    };
  }, [cumulativePageBottoms, cumulativePageTops, state.totalPages]);

  const releaseProgrammaticScroll = useCallback((reason: string) => {
    if (programmaticScrollSafetyTimeoutRef.current) {
      clearTimeout(programmaticScrollSafetyTimeoutRef.current);
      programmaticScrollSafetyTimeoutRef.current = null;
    }

    if (isProgrammaticScrollRef.current) {
      logger.info(
        'Programmatic scroll liberado',
        'FloatingPDFViewer.programmaticScroll',
        { reason }
      );
    }

    isProgrammaticScrollRef.current = false;
  }, []);

  const markProgrammaticScroll = useCallback((reason: string) => {
    if (programmaticScrollSafetyTimeoutRef.current) {
      clearTimeout(programmaticScrollSafetyTimeoutRef.current);
    }

    isProgrammaticScrollRef.current = true;
    programmaticScrollSafetyTimeoutRef.current = setTimeout(() => {
      if (!isProgrammaticScrollRef.current) {
        return;
      }

      logger.warn(
        'Programmatic scroll safety timeout acionado; liberando flag presa',
        'FloatingPDFViewer.programmaticScroll',
        {
          reason,
          timeoutMs: PROGRAMMATIC_SCROLL_SAFETY_TIMEOUT_MS
        }
      );

      isProgrammaticScrollRef.current = false;
      programmaticScrollSafetyTimeoutRef.current = null;
    }, PROGRAMMATIC_SCROLL_SAFETY_TIMEOUT_MS);
  }, []);


  useEffect(() => {
    return () => {
      if (programmaticScrollSafetyTimeoutRef.current) {
        clearTimeout(programmaticScrollSafetyTimeoutRef.current);
        programmaticScrollSafetyTimeoutRef.current = null;
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
      (state.isSearchOpen && !isSearchNavigationActive());

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const buffer = viewportHeight * 1.0;
    const scrollDelta = options?.previousScrollTop !== undefined
      ? Math.abs(scrollTop - options.previousScrollTop)
      : 0;
    const isLargeScrollJump = scrollDelta > viewportHeight * 2;
    const pendingNavigationTarget = pendingNavigationTargetRef.current;
    const hasPendingNavigationTarget = Boolean(pendingNavigationTarget);
    const allowLargeJump = Boolean(
      options?.allowLargeJump ||
      hasPendingNavigationTarget ||
      isLargeScrollJump ||
      (state.isSearchOpen && isSearchNavigationActive()) ||
      (state.highlightedPage && state.highlightedPage === state.currentPage)
    );

    const visiblePages = new Set<number>();
    const viewportCenter = scrollTop + viewportHeight / 2;
    let centerPage = 1;
    let minDistanceToCenter = Infinity;

    const bufferedViewportStart = scrollTop - buffer;
    const bufferedViewportEnd = scrollTop + viewportHeight + buffer;
    const bufferedStartIndex = Math.max(0, findFirstIndexByBottom(cumulativePageBottoms, bufferedViewportStart));
    const bufferedEndIndex = Math.min(
      cumulativePageTops.length - 1,
      findLastIndexByTop(cumulativePageTops, bufferedViewportEnd)
    );

    if (bufferedStartIndex <= bufferedEndIndex) {
      for (let pageIndex = bufferedStartIndex; pageIndex <= bufferedEndIndex; pageIndex++) {
        visiblePages.add(pageIndex + 1);
      }
    }

    const viewportStart = scrollTop;
    const viewportEnd = scrollTop + viewportHeight;
    const visibleStartIndex = Math.max(0, findFirstIndexByBottom(cumulativePageBottoms, viewportStart));
    const visibleEndIndex = Math.min(
      cumulativePageTops.length - 1,
      findLastIndexByTop(cumulativePageTops, viewportEnd)
    );

    if (visibleStartIndex <= visibleEndIndex) {
      visibleStartPageRef.current = visibleStartIndex + 1;
      visibleEndPageRef.current = visibleEndIndex + 1;

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

      visibleStartPageRef.current = centerPage;
      visibleEndPageRef.current = centerPage;
    }

    const scrollHeight = container.scrollHeight;
    if (scrollHeight > viewportHeight && centerPage === 1 && scrollTop > viewportHeight * 0.5) {
      const scrollRatio = scrollTop / (scrollHeight - viewportHeight);
      const estimatedPage = Math.max(1, Math.min(state.totalPages, Math.round(1 + scrollRatio * (state.totalPages - 1))));
      centerPage = estimatedPage;
      visibleStartPageRef.current = Math.max(1, estimatedPage - 2);
      visibleEndPageRef.current = Math.min(state.totalPages, estimatedPage + 2);
    }

    const guaranteedStart = Math.max(1, centerPage - 2);
    const guaranteedEnd = Math.min(state.totalPages, centerPage + 2);
    for (let pageNum = guaranteedStart; pageNum <= guaranteedEnd; pageNum++) {
      visiblePages.add(pageNum);
    }
    if (visibleStartPageRef.current > guaranteedStart) {
      visibleStartPageRef.current = guaranteedStart;
    }
    if (visibleEndPageRef.current < guaranteedEnd) {
      visibleEndPageRef.current = guaranteedEnd;
    }

    if (visiblePages.size > 0 && scrollFallbackVisibleRange !== null) {
      setScrollFallbackVisibleRange(null);
    }

    setScrollBasedVisiblePages(prev => {
      if (visiblePages.size === 0) {
        return prev;
      }
      if (prev.size !== visiblePages.size) return visiblePages;
      for (const page of visiblePages) {
        if (!prev.has(page)) return visiblePages;
      }
      return prev;
    });

    setScrollRenderCache(prev => {
      if (visiblePages.size === 0) {
        return prev;
      }

      const nextSet = new Set(prev);
      const recencyQueue = scrollRenderCacheRecencyQueueRef.current;

      visiblePages.forEach(page => {
        if (page < 1 || page > state.totalPages) {
          return;
        }

        nextSet.add(page);
        const existingIndex = recencyQueue.indexOf(page);
        if (existingIndex >= 0) {
          recencyQueue.splice(existingIndex, 1);
        }
        recencyQueue.push(page);
      });

      while (nextSet.size > CONTINUOUS_RENDER_BUDGET_PAGES && recencyQueue.length > 0) {
        const viewportAnchoredPages = new Set<number>();
        visiblePages.forEach(page => {
          viewportAnchoredPages.add(page);
          if (page - 1 >= 1) viewportAnchoredPages.add(page - 1);
          if (page + 1 <= state.totalPages) viewportAnchoredPages.add(page + 1);
        });

        let evictionIndex = -1;
        for (let index = 0; index < recencyQueue.length; index += 1) {
          const candidate = recencyQueue[index];
          if (visiblePages.has(candidate)) {
            continue;
          }

          if (!nextSet.has(candidate)) {
            evictionIndex = index;
            break;
          }

          if (viewportAnchoredPages.has(candidate)) {
            continue;
          }

          evictionIndex = index;
          break;
        }

        if (evictionIndex === -1) {
          logger.warn(
            'Scroll render cache: sem candidato seguro para eviccao no loop principal',
            'FloatingPDFViewer.calculateVisiblePagesFromScroll',
            {
              budget: CONTINUOUS_RENDER_BUDGET_PAGES,
              cacheSize: nextSet.size,
              visiblePages: Array.from(visiblePages),
              recencyQueueSize: recencyQueue.length
            }
          );
          break;
        }

        const [evictedPage] = recencyQueue.splice(evictionIndex, 1);
        if (evictedPage !== undefined) {
          nextSet.delete(evictedPage);
        }
      }

      if (nextSet.size > CONTINUOUS_RENDER_BUDGET_PAGES) {
        const activeDocumentId = getCurrentDocument()?.id;
        let didFallbackEviction = false;

        for (let index = 0; index < recencyQueue.length && nextSet.size > CONTINUOUS_RENDER_BUDGET_PAGES;) {
          const candidate = recencyQueue[index];
          const candidateDocumentId = getDocumentByGlobalPage(candidate)?.id;
          const isOutsideActiveDocument = activeDocumentId ? candidateDocumentId !== activeDocumentId : true;

          if (!visiblePages.has(candidate) && isOutsideActiveDocument && nextSet.has(candidate)) {
            recencyQueue.splice(index, 1);
            nextSet.delete(candidate);
            didFallbackEviction = true;
            continue;
          }

          index += 1;
        }

        if (!didFallbackEviction && nextSet.size > CONTINUOUS_RENDER_BUDGET_PAGES) {
          logger.warn(
            'Scroll render cache: fallback sem candidato fora do documento ativo e fora da janela visivel',
            'FloatingPDFViewer.calculateVisiblePagesFromScroll',
            {
              budget: CONTINUOUS_RENDER_BUDGET_PAGES,
              cacheSize: nextSet.size,
              activeDocumentId,
              visiblePages: Array.from(visiblePages),
              recencyQueueSize: recencyQueue.length
            }
          );
        }
      }

      if (nextSet.size === prev.size) {
        let didChange = false;
        nextSet.forEach(page => {
          if (!prev.has(page)) {
            didChange = true;
          }
        });
        if (!didChange) {
          return prev;
        }
      }

      return nextSet;
    });

    const centerPageDivergence = Math.abs(centerPage - state.currentPage);
    if (centerPageDivergence >= CURRENT_PAGE_VISIBLE_DIVERGENCE_THRESHOLD_PAGES) {
      if (forcedReconciliationDivergenceStartedAtRef.current === null) {
        forcedReconciliationDivergenceStartedAtRef.current = now;
      }
    } else {
      forcedReconciliationDivergenceStartedAtRef.current = null;
    }

    const divergenceDurationMs = forcedReconciliationDivergenceStartedAtRef.current === null
      ? 0
      : now - forcedReconciliationDivergenceStartedAtRef.current;
    const shouldForceReconciliation =
      centerPageDivergence >= CURRENT_PAGE_VISIBLE_DIVERGENCE_THRESHOLD_PAGES &&
      divergenceDurationMs >= FORCED_RECONCILIATION_DIVERGENCE_DURATION_MS;

    if (shouldForceReconciliation) {
      logger.warn(
        'forced-page-reconciliation',
        'FloatingPDFViewer.calculateVisiblePagesFromScroll',
        {
          centerPage,
          currentPage: state.currentPage,
          deltaPages: centerPageDivergence,
          divergenceDurationMs,
          skipPageChange,
          isProgrammaticScroll: isProgrammaticScrollRef.current,
          pendingNavigationTarget: pendingNavigationTargetRef.current
        }
      );

      pendingNavigationTargetRef.current = null;
      keyboardNavTargetPageRef.current = null;
      keyboardNavTargetReachedAtRef.current = null;
      keyboardNavRecentTargetPageRef.current = null;
      keyboardNavStableFramesRef.current = 0;
      keyboardNavLockUntilRef.current = 0;
      keyboardNavCooldownUntilRef.current = 0;
      forcedReconciliationDivergenceStartedAtRef.current = null;
      currentPageVisibleDivergenceStartedAtRef.current = null;
      currentPageVisibleDivergenceLastLogAtRef.current = 0;
      scrollDivergenceStartedAtRef.current = null;
      scrollDivergenceLastLogAtRef.current = 0;
      zoomAnchorRef.current = null;
      zoomBlockedUntilRef.current = 0;
      offsetRebuildBlockUntilRef.current = 0;
      centerPageFreezeUntilRef.current = 0;

      lastDetectedPageRef.current = centerPage;
      lastDetectionTimeRef.current = now;
      releaseProgrammaticScroll('forced-page-reconciliation');
      goToPage(centerPage);
      return;
    }

    if (pendingNavigationTarget) {
      const pendingElapsedMs = now - pendingNavigationTarget.startedAt;
      const targetPage = pendingNavigationTarget.page;

      if (centerPage === targetPage) {
        lastDetectedPageRef.current = targetPage;
        lastDetectionTimeRef.current = now;
        if (state.currentPage !== targetPage) {
          goToPage(targetPage);
        }
        pendingNavigationTargetRef.current = null;
        return;
      }

      if (pendingElapsedMs > PROGRAMMATIC_SCROLL_RETRY_TIMEOUT_MS) {
        logger.warn(
          `Timeout de convergencia de navegacao (${pendingNavigationTarget.source}): alvo ${targetPage} nao estabilizou apos ${pendingElapsedMs}ms`,
          'FloatingPDFViewer.calculateVisiblePagesFromScroll'
        );
        pendingNavigationTargetRef.current = null;
        releaseProgrammaticScroll('state-change');
      } else {
        if (lastDetectedPageRef.current !== targetPage) {
          lastDetectedPageRef.current = targetPage;
          lastDetectionTimeRef.current = now;
        }
        return;
      }
    }

    const keyboardNavTargetPage = keyboardNavTargetPageRef.current;
    if (keyboardNavTargetPage !== null && state.viewMode === 'continuous') {
      if (now >= keyboardNavLockUntilRef.current) {
        keyboardNavTargetPageRef.current = null;
        keyboardNavTargetReachedAtRef.current = null;
        releaseProgrammaticScroll('state-change');
      } else if (centerPage === keyboardNavTargetPage) {
        if (keyboardNavTargetReachedAtRef.current === null) {
          keyboardNavTargetReachedAtRef.current = now;
        }

        if (now - keyboardNavTargetReachedAtRef.current >= KEYBOARD_NAV_SETTLE_DURATION_MS) {
          keyboardNavTargetPageRef.current = null;
          keyboardNavTargetReachedAtRef.current = null;
          releaseProgrammaticScroll('state-change');
        }
      } else {
        keyboardNavTargetReachedAtRef.current = null;
      }
    }

    const isKeyboardNavCooldownActive =
      state.viewMode === 'continuous' && now < keyboardNavCooldownUntilRef.current;
    const keyboardNavRecentTargetPage = keyboardNavRecentTargetPageRef.current;

    if (isKeyboardNavCooldownActive && keyboardNavRecentTargetPage !== null) {
      const currentDistanceToTarget = Math.abs(state.currentPage - keyboardNavRecentTargetPage);
      const centerDistanceToTarget = Math.abs(centerPage - keyboardNavRecentTargetPage);

      if (centerPage === keyboardNavRecentTargetPage) {
        keyboardNavStableFramesRef.current += 1;

        if (state.currentPage !== centerPage) {
          lastDetectedPageRef.current = centerPage;
          lastDetectionTimeRef.current = now;
          goToPage(centerPage);
          return;
        }

        if (keyboardNavStableFramesRef.current >= KEYBOARD_NAV_TARGET_STABLE_FRAMES) {
          keyboardNavCooldownUntilRef.current = 0;
          keyboardNavStableFramesRef.current = 0;
          keyboardNavRecentTargetPageRef.current = null;
        }
      } else {
        keyboardNavStableFramesRef.current = 0;

        const isConvergingToRecentTarget = centerDistanceToTarget < currentDistanceToTarget;
        if (!isConvergingToRecentTarget) {
          return;
        }
      }
    }

    const isKeyboardNavLockActive = keyboardNavTargetPageRef.current !== null &&
      now < keyboardNavLockUntilRef.current &&
      state.viewMode === 'continuous';

    const hasRecentKeyboardNavigation = (now - keyboardNavLastInputAtRef.current) <= RECENT_NAVIGATION_WINDOW_MS;
    const isCenterPageAnomalousDuringRemount =
      now < centerPageFreezeUntilRef.current &&
      hasRecentKeyboardNavigation &&
      Math.abs(centerPage - state.currentPage) >= REMOUNT_ANOMALOUS_PAGE_DELTA;

    if (isCenterPageAnomalousDuringRemount) {
      logger.info(
        `Congelando centerPage durante remount: center=${centerPage}, current=${state.currentPage}`,
        'FloatingPDFViewer.calculateVisiblePagesFromScroll'
      );
      return;
    }

    const timeSinceLastZoom = now - lastZoomTimestampRef.current;
    const largeDriftFromCurrentPage = centerPageDivergence >= 3;
    const shouldForcePageUpdate = largeDriftFromCurrentPage && timeSinceLastZoom >= ZOOM_PROTECTION_DURATION_MS;

    if (!shouldForcePageUpdate && (timeSinceLastZoom < ZOOM_PROTECTION_DURATION_MS || skipPageChange || now < offsetRebuildBlockUntilRef.current)) {
      return;
    }

    if (shouldForcePageUpdate) {
      releaseProgrammaticScroll('forced-page-update');
      keyboardNavTargetPageRef.current = null;
      keyboardNavLockUntilRef.current = 0;
    }

    if (!shouldForcePageUpdate && isKeyboardNavLockActive && centerPage !== keyboardNavTargetPageRef.current) {
      return;
    }

    const timeSinceLastDetection = now - lastDetectionTimeRef.current;
    const pageDifference = Math.abs(centerPage - lastDetectedPageRef.current);
    const jumpFromCurrentPage = Math.abs(centerPage - state.currentPage);

    if (!shouldForcePageUpdate && pageDifference === 1 && timeSinceLastDetection < 300) {
      return;
    }

    if (!shouldForcePageUpdate && jumpFromCurrentPage > MAX_PAGE_JUMP && !allowLargeJump) {
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
  }, [
    cumulativePageBottoms,
    cumulativePageTops,
    getCurrentDocument,
    getDocumentByGlobalPage,
    goToPage,
    isSearchNavigationActive,
    releaseProgrammaticScroll,
    state.currentPage,
    state.highlightedPage,
    state.isSearchOpen,
    state.totalPages,
    state.viewMode,
    scrollFallbackVisibleRange
  ]);

  const startProgrammaticPageNavigation = useCallback((targetPage: number, source: 'highlight' | 'manual' | 'search', syncCurrentPage = false) => {
    if (state.viewMode !== 'continuous') {
      if (syncCurrentPage) {
        goToPage(targetPage);
      }
      return;
    }

    const startedAt = Date.now();
    markProgrammaticScroll('state-change');
    pendingNavigationTargetRef.current = { page: targetPage, source, startedAt };
    lastDetectedPageRef.current = targetPage;
    lastDetectionTimeRef.current = startedAt;

    if (syncCurrentPage) {
      goToPage(targetPage);
    }

    const scrollToTargetPage = () => {
      const pageElement = pageRefs.current.get(targetPage);
      if (pageElement && scrollContainerRef.current) {
        pageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
        setTimeout(() => {
          releaseProgrammaticScroll('state-change');
        }, PROGRAMMATIC_SCROLL_RELEASE_DELAY_MS);
        return;
      }

      if (Date.now() - startedAt < PROGRAMMATIC_SCROLL_RETRY_TIMEOUT_MS) {
        requestAnimationFrame(scrollToTargetPage);
      } else {
        logger.warn(
          `Timeout ao localizar elemento da pagina ${targetPage} para navegacao ${source}`,
          'FloatingPDFViewer.startProgrammaticPageNavigation'
        );
        if (pendingNavigationTargetRef.current?.page === targetPage) {
          pendingNavigationTargetRef.current = null;
        }
        releaseProgrammaticScroll('state-change');
      }
    };

    scrollToTargetPage();
  }, [goToPage, markProgrammaticScroll, releaseProgrammaticScroll, state.viewMode]);

  useEffect(() => {
    calculateVisiblePagesFromScrollRef.current = calculateVisiblePagesFromScroll;
  }, [calculateVisiblePagesFromScroll]);

  useEffect(() => {
    estimateCenterPageFromScrollRef.current = (scrollTop: number, viewportHeight: number) => {
      if (state.totalPages === 0 || cumulativePageBottoms.length === 0) {
        return 1;
      }

      const viewportCenter = scrollTop + viewportHeight / 2;
      const centerIndex = findFirstIndexByBottom(cumulativePageBottoms, viewportCenter);
      return Math.min(state.totalPages, Math.max(1, centerIndex >= state.totalPages ? state.totalPages : centerIndex + 1));
    };
  }, [cumulativePageBottoms, state.totalPages]);

  useEffect(() => {
    markInteractionStartRef.current = markInteractionStart;
  }, [markInteractionStart]);

  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    setScrollContainerElement(node);
  }, []);

  /**
   * Effect para detectar paginas visiveis durante scroll
   * Usa throttle para performance - atualiza a cada 50ms durante scroll
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous' || !scrollContainerElement) return;

    const container = scrollContainerElement;

    const clearScrollReconciliation = () => {
      if (scrollReconciliationRafRef.current !== null) {
        cancelAnimationFrame(scrollReconciliationRafRef.current);
        scrollReconciliationRafRef.current = null;
      }

      if (scrollReconciliationTimeoutRef.current) {
        clearTimeout(scrollReconciliationTimeoutRef.current);
        scrollReconciliationTimeoutRef.current = null;
      }
    };

    const trackDivergence = (scrollTop: number, centerPage: number) => {
      const currentPage = currentPageRef.current;
      if (currentPage === centerPage) {
        scrollDivergenceStartedAtRef.current = null;
        return;
      }

      const now = Date.now();
      if (scrollDivergenceStartedAtRef.current === null) {
        scrollDivergenceStartedAtRef.current = now;
        return;
      }

      const divergenceDurationMs = now - scrollDivergenceStartedAtRef.current;
      const shouldLog = divergenceDurationMs > 500 && now - scrollDivergenceLastLogAtRef.current > 500;

      if (shouldLog) {
        scrollDivergenceLastLogAtRef.current = now;
        logger.info(
          'DEBUG TEMP scroll divergence detectada no fallback de reconciliação',
          'FloatingPDFViewer.handleScrollReconciliation',
          {
            scrollTop,
            currentPage,
            centerPage,
            divergenceDurationMs
          }
        );
      }

      const DIVERGENCE_FIX_THRESHOLD_MS = 300;
      const pageDivergence = Math.abs(currentPage - centerPage);
      if (divergenceDurationMs >= DIVERGENCE_FIX_THRESHOLD_MS && pageDivergence > 2) {
        if (!isProgrammaticScrollRef.current && now > zoomBlockedUntilRef.current) {
          scrollDivergenceStartedAtRef.current = null;
          lastDetectedPageRef.current = centerPage;
          lastDetectionTimeRef.current = now;
          goToPage(centerPage);
        }
      }
    };

    const scheduleScrollReconciliation = (previousScrollTop: number, nextScrollTop: number) => {
      if (Math.abs(nextScrollTop - previousScrollTop) < 1) {
        return;
      }

      clearScrollReconciliation();
      let hasReconciled = false;

      const runReconciliation = () => {
        if (hasReconciled) {
          return;
        }
        hasReconciled = true;

        if (scrollReconciliationTimeoutRef.current) {
          clearTimeout(scrollReconciliationTimeoutRef.current);
        }
        scrollReconciliationRafRef.current = null;
        scrollReconciliationTimeoutRef.current = null;

        if (!scrollContainerRef.current || state.viewMode !== 'continuous') {
          return;
        }

        if (isModeSwitchingRef.current || state.isRotating) {
          return;
        }

        const activeScrollTop = scrollContainerRef.current.scrollTop;
        const centerPage = estimateCenterPageFromScrollRef.current(activeScrollTop, scrollContainerRef.current.clientHeight);

        calculateVisiblePagesFromScrollRef.current({ previousScrollTop });
        trackDivergence(activeScrollTop, centerPage);
      };

      scrollReconciliationRafRef.current = requestAnimationFrame(runReconciliation);
      scrollReconciliationTimeoutRef.current = setTimeout(runReconciliation, 48);
    };

    const handleScroll = () => {
      const now = Date.now();
      isUserScrollingRef.current = true;
      if (scrollIdleTimeoutRef.current) {
        clearTimeout(scrollIdleTimeoutRef.current);
      }
      scrollIdleTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
        emptyVisiblePagesScrollFramesRef.current = 0;
      }, SCROLL_ACTIVITY_IDLE_TIMEOUT_MS);

      if (scrollBasedVisiblePages.size === 0) {
        emptyVisiblePagesScrollFramesRef.current += 1;
        if (emptyVisiblePagesScrollFramesRef.current > EMPTY_VISIBLE_PAGES_SCROLL_FRAME_THRESHOLD) {
          const fallbackRange = deriveVisibleRangeFromContainer();
          setScrollFallbackVisibleRange(prev => {
            if (!fallbackRange) {
              return prev;
            }
            if (prev?.start === fallbackRange.start && prev?.end === fallbackRange.end) {
              return prev;
            }
            return fallbackRange;
          });
        }
      } else {
        emptyVisiblePagesScrollFramesRef.current = 0;
        setScrollFallbackVisibleRange(prev => (prev === null ? prev : null));
      }

      const shouldBlockForDrag =
        isPointerDownRef.current &&
        hasDragRef.current &&
        now < dragScrollBlockUntilRef.current;

      if (shouldBlockForDrag) {
        return;
      }

      markInteractionStartRef.current();

      const scrollHeight = container.scrollHeight;
      if (scrollHeight > 0 && !isProgrammaticScrollRef.current) {
        const scrollableHeight = Math.max(0, scrollHeight - container.clientHeight);
        scrollRatioBeforeZoomRef.current = scrollableHeight > 0
          ? container.scrollTop / scrollableHeight
          : 0;
      }

      const previousScrollTop = lastScrollTopRef.current;
      const nextScrollTop = container.scrollTop;
      lastScrollTopRef.current = nextScrollTop;

      scheduleScrollReconciliation(previousScrollTop, nextScrollTop);

      if (now - scrollThrottleRef.current < 80) {
        return;
      }
      scrollThrottleRef.current = now;

      calculateVisiblePagesFromScrollRef.current({ previousScrollTop });
    };

    const scheduleInitialScrollRecalculation = () => {
      let hasRun = false;

      const runInitialRecalculation = () => {
        if (hasRun) {
          return;
        }

        const activeContainer = scrollContainerRef.current;
        if (!activeContainer || state.viewMode !== 'continuous' || totalPagesRef.current === 0) {
          return;
        }

        const now = Date.now();
        const hasKeyboardNavigationGuard =
          keyboardNavTargetPageRef.current !== null ||
          now < keyboardNavLockUntilRef.current ||
          now < keyboardNavCooldownUntilRef.current;

        if (pendingNavigationTargetRef.current || hasKeyboardNavigationGuard || now < offsetRebuildBlockUntilRef.current) {
          return;
        }

        const { scrollHeight, clientHeight } = activeContainer;
        const hasStableLayout = scrollHeight > 0 && clientHeight > 0 && scrollHeight >= clientHeight;
        if (!hasStableLayout) {
          return;
        }

        const currentPage = currentPageRef.current;
        const windowStart = Math.max(1, currentPage - CONTINUOUS_WINDOW_BUFFER_PAGES);
        const windowEnd = Math.min(totalPagesRef.current, currentPage + CONTINUOUS_WINDOW_BUFFER_PAGES);
        const activeWindowPages = windowEnd >= windowStart
          ? Array.from({ length: windowEnd - windowStart + 1 }, (_, index) => windowStart + index)
          : [currentPage];

        const mountedPagesInWindow = activeWindowPages.filter(pageNum => pageRefs.current.has(pageNum)).length;
        const minMountedPages = Math.min(activeWindowPages.length, Math.max(1, Math.ceil(activeWindowPages.length / 2)));
        const hasMountedActiveWindow = pageRefs.current.has(currentPage) && mountedPagesInWindow >= minMountedPages;

        if (!hasMountedActiveWindow) {
          return;
        }

        hasRun = true;
        calculateVisiblePagesFromScrollRef.current();
      };

      initialScrollRecalcRafRef.current = requestAnimationFrame(() => {
        initialScrollRecalcRafNestedRef.current = requestAnimationFrame(runInitialRecalculation);
      });

      initialScrollRecalcTimeoutRef.current = setTimeout(runInitialRecalculation, 96);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    logger.info(
      'Scroll listener instalado no container do PDF',
      'FloatingPDFViewer.handleScrollEffect',
      { viewMode: state.viewMode }
    );
    scheduleInitialScrollRecalculation();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearScrollReconciliation();
      scrollDivergenceStartedAtRef.current = null;

      if (initialScrollRecalcRafRef.current !== null) {
        cancelAnimationFrame(initialScrollRecalcRafRef.current);
        initialScrollRecalcRafRef.current = null;
      }

      if (initialScrollRecalcRafNestedRef.current !== null) {
        cancelAnimationFrame(initialScrollRecalcRafNestedRef.current);
        initialScrollRecalcRafNestedRef.current = null;
      }

      if (initialScrollRecalcTimeoutRef.current) {
        clearTimeout(initialScrollRecalcTimeoutRef.current);
        initialScrollRecalcTimeoutRef.current = null;
      }

      if (scrollIdleTimeoutRef.current) {
        clearTimeout(scrollIdleTimeoutRef.current);
        scrollIdleTimeoutRef.current = null;
      }

      isUserScrollingRef.current = false;
      emptyVisiblePagesScrollFramesRef.current = 0;
      setScrollFallbackVisibleRange(null);
    };
  }, [deriveVisibleRangeFromContainer, scrollBasedVisiblePages, scrollContainerElement, state.viewMode]);

  useEffect(() => {
    registerScrollContainer(scrollContainerElement);
    return () => {
      registerScrollContainer(null);
    };
  }, [registerScrollContainer, scrollContainerElement]);

  useEffect(() => {
    if (state.isSearchOpen) {
      calculateVisiblePagesFromScrollRef.current({ allowLargeJump: true });
    }
  }, [state.isSearchOpen]);

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
          bookmarkExtractionLoadedRef.current.clear();
          bookmarkExtractionFailedRef.current.clear();
          bookmarkExtractionInFlightRef.current.clear();
          resetBookmarksStatusByDoc(state.documents.map(doc => doc.id));
          setIsLoadingBookmarks(false);
          return new Map();
        }
        return prev;
      });
    }
  }, [state.documents, resetBookmarksStatusByDoc, setIsLoadingBookmarks]);

  useEffect(() => {
    heavyTaskGenerationRef.current += 1;
    cancelHeavyTasks('viewer-closed-or-document-set-changed');

    if (!state.isOpen) {
      lastOpenDocumentSetSignatureRef.current = null;
      setPdfDocumentProxies(new Map());
      setDocumentPages(new Map());
      setDocumentBookmarks(new Map());
      loadedDocumentRefsByGenerationRef.current.clear();
      proxyGenerationByDocumentRef.current.clear();
      documentMountLastSeenAtRef.current.clear();
      documentConfirmedHeightsRef.current.clear();
      previouslyMountedDocumentsRef.current.clear();
      offsetRebuildBlockUntilRef.current = 0;
      centerPageFreezeUntilRef.current = 0;
      setBookmarks([]);
      setIsLoadingBookmarks(false);
      return;
    }

    const isNewDocumentSet = lastOpenDocumentSetSignatureRef.current !== documentSetSignature;
    if (isNewDocumentSet) {
      documentSetGenerationRef.current += 1;
      setPdfDocumentProxies(new Map());
      setDocumentPages(new Map());
      setDocumentBookmarks(new Map());

      bookmarkExtractionLoadedRef.current.clear();
      bookmarkExtractionFailedRef.current.clear();
      bookmarkExtractionInFlightRef.current.clear();
      loadedDocumentRefsByGenerationRef.current.clear();
      proxyGenerationByDocumentRef.current.clear();
      documentMountLastSeenAtRef.current.clear();
      documentConfirmedHeightsRef.current.clear();
      previouslyMountedDocumentsRef.current.clear();
      offsetRebuildBlockUntilRef.current = 0;
      centerPageFreezeUntilRef.current = 0;

      setBookmarks([]);
      setIsLoadingBookmarks(false);
      resetBookmarksStatusByDoc(state.documents.map(doc => doc.id));
    }

    lastOpenDocumentSetSignatureRef.current = documentSetSignature;

    commentsLoadStartedRef.current = false;
    commentsLoadedDocsRef.current.clear();
    commentsLoadInFlightRef.current.clear();
    commentsByDocumentRef.current.clear();

    bookmarkExtractionLoadedRef.current.clear();
    bookmarkExtractionFailedRef.current.clear();
    bookmarkExtractionInFlightRef.current.clear();

    resetBookmarksStatusByDoc(state.documents.map(doc => doc.id));
  }, [state.isOpen, state.documents, documentSetSignature, cancelHeavyTasks, resetBookmarksStatusByDoc, setBookmarks, setIsLoadingBookmarks]);

  useEffect(() => {
    const hasLoadingBookmarks = Array.from(state.bookmarksStatusByDoc.values()).some(status => status === 'loading');
    setIsLoadingBookmarks(hasLoadingBookmarks);
  }, [state.bookmarksStatusByDoc, setIsLoadingBookmarks]);

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

  const loadCommentsForDocument = useCallback(async (documentId: string, signal: AbortSignal) => {
    if (!state.isOpen || commentsLoadInFlightRef.current.has(documentId) || commentsLoadedDocsRef.current.has(documentId)) {
      return;
    }

    commentsLoadInFlightRef.current.add(documentId);

    try {
      const comments = await PDFCommentsService.getCommentsWithConnectorsByDocument(documentId);
      if (signal.aborted || !state.isOpen) {
        return;
      }

      commentsLoadedDocsRef.current.add(documentId);
      commentsByDocumentRef.current.set(documentId, comments);
      setComments(Array.from(commentsByDocumentRef.current.values()).flat());
    } catch (error) {
      if (!signal.aborted) {
        logger.warn(
          'Erro ao carregar comentários do documento (não bloqueante)',
          'FloatingPDFViewer.loadCommentsForDocument',
          { documentId, error }
        );
      }
    } finally {
      commentsLoadInFlightRef.current.delete(documentId);
    }
  }, [state.isOpen, setComments]);

  const enqueueCommentsLoad = useCallback((prioritizedDocumentIds: string[]) => {
    const queue = prioritizedDocumentIds.filter(id => !commentsLoadedDocsRef.current.has(id));
    if (queue.length === 0) {
      return;
    }


    queue.forEach((documentId, index) => {
      enqueueHeavyTask({
        id: `comments:${documentId}`,
        type: 'comments',
        documentId,
        priority: 1000 - index,
        run: async (signal) => {
          await loadCommentsForDocument(documentId, signal);
          if (!signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, COMMENTS_BATCH_DELAY_MS));
          }
        }
      });
    });
  }, [enqueueHeavyTask, loadCommentsForDocument]);

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

    const TEXT_SPAN_SELECTOR = '.textLayer > span, .textLayer span[role="presentation"]';
    const TEXT_LAYER_LOCAL_SPAN_SELECTOR = ':scope > span, :scope span[role="presentation"]';

    const isSelectableSpan = (span: Element): span is HTMLElement => {
      if (!(span instanceof HTMLElement)) return false;
      const textNode = span.firstChild;
      return !!textNode && textNode.nodeType === Node.TEXT_NODE && (textNode.textContent?.length || 0) > 0;
    };

    const getSelectableSpans = (root: ParentNode, selector = TEXT_SPAN_SELECTOR): HTMLElement[] => {
      const spans = root.querySelectorAll(selector);
      return Array.from(spans).filter(isSelectableSpan);
    };

    const getSpansForPage = (pageNumber: number): HTMLElement[] => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return [];
      const pageEl = scrollContainer.querySelector(`[data-global-page="${pageNumber}"]`);
      if (!pageEl) return [];
      return getSelectableSpans(pageEl);
    };

    const getAllTextSpans = (): HTMLElement[] => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return [];
      return getSelectableSpans(scrollContainer);
    };

    const getVisibleSpansFromTextLayer = (textLayer: HTMLElement): HTMLElement[] => {
      return getSelectableSpans(textLayer, TEXT_LAYER_LOCAL_SPAN_SELECTOR)
        .filter(span => {
          const rect = span.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
    };

    const getSpanDistanceFromPoint = (span: HTMLElement, clientX: number, clientY: number): number => {
      const rect = span.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return Math.abs(centerY - clientY) * 10 + Math.abs(centerX - clientX);
    };

    const findNearestSpanByCoordinates = (spans: HTMLElement[], clientX: number, clientY: number): HTMLElement | null => {
      if (spans.length === 0) return null;

      let bestSpan: HTMLElement | null = null;
      let bestDistance = Infinity;

      for (const span of spans) {
        const distance = getSpanDistanceFromPoint(span, clientX, clientY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSpan = span;
        }
      }

      return bestSpan;
    };

    const applyRangeWithOverlayGuard = (range: Range, source: 'caret-click' | 'caret-arrow' | 'caret-shift-arrow' | 'caret-shift-click' | 'caret-triple-click') => {
      if (!canWriteProgrammaticSelection) {
        return false;
      }
      return applySelectionSafely(range, source);
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
      const maxPos = Math.min(position, textNode.textContent?.length || 0);
      range.setStart(textNode, maxPos);
      range.collapse(true);
      applyRangeWithOverlayGuard(range, 'caret-click');
    };

    const createSelectionBetween = (
      startSpan: HTMLElement,
      startOffset: number,
      endSpan: HTMLElement,
      endOffset: number,
      source: 'caret-shift-click' | 'caret-shift-arrow' = 'caret-shift-click'
    ) => {
      const spans = getAllTextSpans();

      if (spans.length === 0) {
        return false;
      }

      const getSpanCenterDistance = (candidate: HTMLElement, referenceRect: DOMRect): number => {
        const rect = candidate.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const refCenterX = referenceRect.left + referenceRect.width / 2;
        const refCenterY = referenceRect.top + referenceRect.height / 2;
        return Math.hypot(centerX - refCenterX, centerY - refCenterY);
      };

      const findClosestByRectCenter = (candidates: HTMLElement[], referenceRect: DOMRect): HTMLElement | null => {
        if (candidates.length === 0) return null;
        let best: HTMLElement | null = null;
        let bestDistance = Infinity;
        for (const candidate of candidates) {
          const distance = getSpanCenterDistance(candidate, referenceRect);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
          }
        }
        return best;
      };

      const remapSpanToGlobalCollection = (span: HTMLElement): HTMLElement | null => {
        if (spans.includes(span)) return span;

        const spanPageNumber = getPageNumber(span);
        const pageCandidates = spanPageNumber
          ? spans.filter(candidate => getPageNumber(candidate) === spanPageNumber)
          : [];

        if (pageCandidates.length > 0) {
          const sameTextLayer = span.closest('.textLayer');
          if (sameTextLayer) {
            const localSpans = getSelectableSpans(sameTextLayer, TEXT_LAYER_LOCAL_SPAN_SELECTOR);
            const localIndex = localSpans.indexOf(span);
            if (localIndex >= 0) {
              const pageSameLayer = pageCandidates.filter(candidate => candidate.closest('.textLayer') === sameTextLayer);
              if (pageSameLayer[localIndex]) {
                return pageSameLayer[localIndex];
              }
            }
          }

          const spanRect = span.getBoundingClientRect();
          const fallbackByDistance = findClosestByRectCenter(pageCandidates, spanRect);

          if (fallbackByDistance) {
            return fallbackByDistance;
          }
        }

        return findClosestByRectCenter(spans, span.getBoundingClientRect());
      };

      const mappedStartSpan = remapSpanToGlobalCollection(startSpan);
      const mappedEndSpan = remapSpanToGlobalCollection(endSpan);
      if (!mappedStartSpan || !mappedEndSpan) {
        return false;
      }

      const startIndex = spans.indexOf(mappedStartSpan);
      const endIndex = spans.indexOf(mappedEndSpan);
      if (startIndex === -1 || endIndex === -1) {
        return false;
      }

      const range = document.createRange();

      let actualStartSpan = mappedStartSpan;
      let actualStartOffset = startOffset;
      let actualEndSpan = mappedEndSpan;
      let actualEndOffset = endOffset;

      if (startIndex > endIndex || (startIndex === endIndex && startOffset > endOffset)) {
        actualStartSpan = mappedEndSpan;
        actualStartOffset = endOffset;
        actualEndSpan = mappedStartSpan;
        actualEndOffset = startOffset;
      }

      const startNode = actualStartSpan.firstChild;
      const endNode = actualEndSpan.firstChild;

      if (!startNode || !endNode) {
        return false;
      }

      const maxStartOffset = Math.min(actualStartOffset, startNode.textContent?.length || 0);
      const maxEndOffset = Math.min(actualEndOffset, endNode.textContent?.length || 0);

      range.setStart(startNode, maxStartOffset);
      range.setEnd(endNode, maxEndOffset);

      applyRangeWithOverlayGuard(range, source);
      return true;
    };

    const getClickOffset = (span: HTMLElement, clientX: number): number => {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;

      const text = textNode.textContent || '';
      if (text.length === 0) return 0;

      const range = document.createRange();
      let lo = 0;
      let hi = text.length;

      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        range.setStart(textNode, mid);
        range.setEnd(textNode, mid);
        const rect = range.getBoundingClientRect();
        if (rect.left < clientX) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      return lo;
    };

    const getClickOffsetByCoordinates = (span: HTMLElement, clientX: number, clientY: number): number => {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;

      const text = textNode.textContent || '';
      if (text.length === 0) return 0;

      const range = document.createRange();
      let bestOffset = 0;
      let bestDistance = Infinity;

      for (let i = 0; i <= text.length; i++) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i);
        const rect = range.getBoundingClientRect();
        const dx = rect.left - clientX;
        const dy = rect.top - clientY;
        const distance = Math.abs(dy) * 10 + Math.abs(dx);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestOffset = i;
        }
      }

      return bestOffset;
    };

    const resolveNearestSpanFromPoint = (textLayer: HTMLElement, clientX: number, clientY: number): HTMLElement | null =>
      findNearestSpanByCoordinates(getVisibleSpansFromTextLayer(textLayer), clientX, clientY);

    const inferClickPageNumber = (
      target: HTMLElement,
      clientX: number,
      clientY: number,
      selectionAnchorState: { span: HTMLElement; offset: number }
    ): number | null => {
      const directPageElement = target.closest('[data-global-page]');
      if (directPageElement) {
        return parseInt(directPageElement.getAttribute('data-global-page') || '0', 10) || null;
      }

      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        const pages = Array.from(scrollContainer.querySelectorAll('[data-global-page]'));
        for (const pageElement of pages) {
          if (!(pageElement instanceof HTMLElement)) continue;
          const rect = pageElement.getBoundingClientRect();
          const containsPoint = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
          if (containsPoint) {
            return parseInt(pageElement.getAttribute('data-global-page') || '0', 10) || null;
          }
        }
      }

      return getPageNumber(selectionAnchorState.span);
    };

    const resolveShiftClickTarget = (
      target: HTMLElement,
      selectionAnchorState: { span: HTMLElement; offset: number },
      clientX: number,
      clientY: number,
      clickPage: number | null
    ): { span: HTMLElement; offset: number } | null => {
      const directSpan = target.closest(TEXT_SPAN_SELECTOR) as HTMLElement | null;
      if (directSpan && isSelectableSpan(directSpan)) {
        return { span: directSpan, offset: getClickOffsetByCoordinates(directSpan, clientX, clientY) };
      }

      const activeTextLayer = target.closest('.textLayer') as HTMLElement | null;
      const nearestInActiveLayer = activeTextLayer
        ? resolveNearestSpanFromPoint(activeTextLayer, clientX, clientY)
        : null;

      if (nearestInActiveLayer) {
        return {
          span: nearestInActiveLayer,
          offset: getClickOffsetByCoordinates(nearestInActiveLayer, clientX, clientY)
        };
      }

      if (clickPage) {
        const clickPageSpans = getSpansForPage(clickPage);
        const clickPageFallback = findNearestSpanByCoordinates(clickPageSpans, clientX, clientY);
        if (clickPageFallback) {
          return {
            span: clickPageFallback,
            offset: getClickOffsetByCoordinates(clickPageFallback, clientX, clientY)
          };
        }
      }

      const anchorPage = getPageNumber(selectionAnchorState.span);
      if (!anchorPage) {
        return null;
      }

      const anchorPageSpans = getSpansForPage(anchorPage);
      const fallbackSpan = findNearestSpanByCoordinates(anchorPageSpans, clientX, clientY);
      if (!fallbackSpan) {
        return null;
      }

      return {
        span: fallbackSpan,
        offset: getClickOffsetByCoordinates(fallbackSpan, clientX, clientY)
      };
    };

    const selectWord = (span: HTMLElement, offset: number) => {
      const text = span.textContent || '';
      if (!text) return;

      let wordStart = offset;
      let wordEnd = offset;

      while (wordStart > 0 && /\w/.test(text[wordStart - 1])) {
        wordStart--;
      }
      while (wordEnd < text.length && /\w/.test(text[wordEnd])) {
        wordEnd++;
      }

      if (wordStart === wordEnd) {
        wordStart = Math.max(0, offset - 1);
        wordEnd = Math.min(text.length, offset + 1);
      }

      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

      const range = document.createRange();
      range.setStart(textNode, wordStart);
      range.setEnd(textNode, wordEnd);
      applyRangeWithOverlayGuard(range, 'caret-click');

      startedInsidePdfRef.current = true;
    };

    const selectSentence = (span: HTMLElement) => {
      const pageNumber = getPageNumber(span);
      if (!pageNumber) return;

      const spans = getSpansForPage(pageNumber);
      if (spans.length === 0) return;

      const spanRect = span.getBoundingClientRect();
      const lineThreshold = spanRect.height * 0.5;

      const lineSpans: HTMLElement[] = [];
      for (const s of spans) {
        const rect = s.getBoundingClientRect();
        if (Math.abs(rect.top - spanRect.top) < lineThreshold) {
          lineSpans.push(s);
        }
      }

      lineSpans.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

      if (lineSpans.length === 0) return;

      const firstSpan = lineSpans[0];
      const lastSpan = lineSpans[lineSpans.length - 1];
      const firstNode = firstSpan.firstChild;
      const lastNode = lastSpan.firstChild;

      if (!firstNode || !lastNode) return;

      const range = document.createRange();
      range.setStart(firstNode, 0);
      range.setEnd(lastNode, lastNode.textContent?.length || 0);
      applyRangeWithOverlayGuard(range, 'caret-click');

      startedInsidePdfRef.current = true;
    };

    const handleClick = (e: MouseEvent) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const target = e.target as HTMLElement;
      const isInScrollContainer = scrollContainer.contains(target);
      if (!isInScrollContainer) return;

      const textLayer = target.closest('.textLayer') as HTMLElement | null;
      const textLayerSpan = target.closest(TEXT_SPAN_SELECTOR) as HTMLElement | null;

      if (e.shiftKey && selectionAnchor) {
        const clickPage = inferClickPageNumber(target, e.clientX, e.clientY, selectionAnchor);

        const resolved = resolveShiftClickTarget(target, selectionAnchor, e.clientX, e.clientY, clickPage);

        if (resolved) {
          activateCaret(resolved.span, true);
          const selectionApplied = createSelectionBetween(
            selectionAnchor.span,
            selectionAnchor.offset,
            resolved.span,
            resolved.offset,
            'caret-shift-click'
          );
          if (selectionApplied) {
            currentFocus = { span: resolved.span, offset: resolved.offset };
          }
          return;
        }

        if (textLayer || clickPage) {
          return;
        }

        deactivateCaret();
        return;
      }

      if (e.detail === 2 && textLayerSpan && textLayerSpan.textContent?.trim()) {
        const clickOffset = getClickOffset(textLayerSpan, e.clientX);
        selectWord(textLayerSpan, clickOffset);
        deactivateCaret();
        return;
      }

      if (e.detail >= 3 && textLayerSpan && textLayerSpan.textContent?.trim()) {
        selectSentence(textLayerSpan);
        deactivateCaret();
        return;
      }

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
      } else if (!textLayer) {
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

      const spanRects = new Map<HTMLElement, DOMRect>();
      for (const span of spans) {
        if (span !== currentSpan) {
          spanRects.set(span, span.getBoundingClientRect());
        }
      }

      let bestSpan: HTMLElement | null = null;
      let bestDistance = Infinity;

      for (const [span, rect] of spanRects) {
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
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, nextSpan, 0, 'caret-shift-arrow');
            currentFocus = { span: nextSpan, offset: 0 };
          } else {
            setCaretPosition(nextSpan, 0);
            selectionAnchor = { span: nextSpan, offset: 0 };
            currentFocus = { span: nextSpan, offset: 0 };
          }
        } else if (focusPos < textLength) {
          const newPos = focusPos + 1;
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, currentSpan, newPos, 'caret-shift-arrow');
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
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, prevSpan, prevLength, 'caret-shift-arrow');
            currentFocus = { span: prevSpan, offset: prevLength };
          } else {
            setCaretPosition(prevSpan, prevLength);
            selectionAnchor = { span: prevSpan, offset: prevLength };
            currentFocus = { span: prevSpan, offset: prevLength };
          }
        } else if (focusPos > 0) {
          const newPos = focusPos - 1;
          if (isShift && selectionAnchor) {
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, currentSpan, newPos, 'caret-shift-arrow');
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
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, nextSpan, newPos, 'caret-shift-arrow');
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
            createSelectionBetween(selectionAnchor.span, selectionAnchor.offset, prevSpan, newPos, 'caret-shift-arrow');
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
  }, [applySelectionSafely, canWriteProgrammaticSelection]);

  /**
   * Effect para detectar seleção de texto com pointer events
   * Usa pointerdown/pointermove/pointerup para detectar arrasto real (não cliques simples)
   * Previne falsos positivos de selectstart que dispara até em cliques simples
   *
   * IMPORTANTE: Os handlers verificam scrollContainerRef.current internamente
   * para evitar problemas de timing onde o ref não está disponível na montagem inicial
   */
  useEffect(() => {
    const logFlagTransition = (flagName: 'isPointerDownRef' | 'isSelectingTextRef', previous: boolean, next: boolean, reason: string) => {
      if (!(previous && !next)) {
        return;
      }

      logger.info(
        `DEBUG TEMP ${flagName} true -> false`,
        'FloatingPDFViewer.textSelectionGuards',
        { reason }
      );
    };

    const setPointerDownFlag = (nextValue: boolean, reason: string) => {
      const previous = isPointerDownRef.current;
      if (previous === nextValue) {
        return;
      }

      isPointerDownRef.current = nextValue;
      logFlagTransition('isPointerDownRef', previous, nextValue, reason);
    };

    const setSelectingTextFlag = (nextValue: boolean, reason: string) => {
      const previous = isSelectingTextRef.current;
      if (previous === nextValue) {
        return;
      }

      isSelectingTextRef.current = nextValue;
      logFlagTransition('isSelectingTextRef', previous, nextValue, reason);
    };

    const schedulePointerDownSafetyReset = () => {
      if (pointerDownSafetyTimeoutRef.current) {
        clearTimeout(pointerDownSafetyTimeoutRef.current);
      }

      pointerDownSafetyTimeoutRef.current = setTimeout(() => {
        setPointerDownFlag(false, 'pointerdown-safety-timeout');
        isPointerDownInPdfRef.current = false;
        hasDragRef.current = false;
      }, POINTER_DOWN_SAFETY_RESET_MS);
    };

    const scheduleSelectionSafetyReset = (reason: string) => {
      if (textSelectionSafetyTimeoutRef.current) {
        clearTimeout(textSelectionSafetyTimeoutRef.current);
      }

      textSelectionSafetyTimeoutRef.current = setTimeout(() => {
        const scrollContainer = scrollContainerRef.current;
        const selection = window.getSelection();
        const selectedText = extractTextFromSelection(selection);
        const hasValidSelection = selectedText.length > 0;
        const anchorInPdf = !!(scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode));
        const focusInPdf = !!(scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode));
        const hasSelectionInPdf = hasValidSelection && anchorInPdf && focusInPdf;

        if (!hasSelectionInPdf) {
          setSelectingTextFlag(false, `${reason}-safety-timeout`);
          textSelectionActivatedAtRef.current = null;
          startedInsidePdfRef.current = false;
        }
      }, TEXT_SELECTION_SAFETY_RESET_MS);
    };

    const updateSelectionStateFromDom = () => {
      const scrollContainer = scrollContainerRef.current;
      const selection = window.getSelection();
      const selectedText = extractTextFromSelection(selection);
      const hasValidSelection = selectedText.length > 0;
      const anchorInPdf = !!(scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode));
      const focusInPdf = !!(scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode));
      const hasSelectionInPdf = hasValidSelection && anchorInPdf && focusInPdf;

      setSelectingTextFlag(hasSelectionInPdf, 'selectionchange');
      textSelectionActivatedAtRef.current = hasSelectionInPdf ? Date.now() : null;
      scheduleSelectionSafetyReset('selectionchange');

      if (!hasSelectionInPdf) {
        startedInsidePdfRef.current = false;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      setPointerDownFlag(true, 'pointerdown');
      schedulePointerDownSafetyReset();

      const target = e.target as HTMLElement;
      const isInsidePdf = scrollContainer.contains(target);
      const isInTextLayer = !!target.closest('.textLayer');
      const isInReactPdfPage = !!target.closest('.react-pdf__Page');
      startedInsidePdfRef.current = isInsidePdf || isInTextLayer || isInReactPdfPage;

      if (startedInsidePdfRef.current) {
        isPointerDownInPdfRef.current = true;
        hasDragRef.current = false;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPointerDownInPdfRef.current && (e.buttons === 1 || e.pressure > 0)) {
        schedulePointerDownSafetyReset();

        if (!hasDragRef.current) {
          hasDragRef.current = true;
          setSelectingTextFlag(true, 'pointermove-start-drag');
        }

        textSelectionActivatedAtRef.current = Date.now();
        dragScrollBlockUntilRef.current = Date.now() + DRAG_SCROLL_BLOCK_WINDOW_MS;
        scheduleSelectionSafetyReset('pointermove');
      }
    };

    const handlePointerUp = () => {
      const scrollContainer = scrollContainerRef.current;

      if (pointerDownSafetyTimeoutRef.current) {
        clearTimeout(pointerDownSafetyTimeoutRef.current);
        pointerDownSafetyTimeoutRef.current = null;
      }

      setPointerDownFlag(false, 'pointerup');

      const selection = window.getSelection();
      const selectedText = extractTextFromSelection(selection);
      const hasValidSelection = selectedText.length > 0;
      const anchorInPdf = !!(scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode));
      const focusInPdf = !!(scrollContainer && selection?.focusNode && scrollContainer.contains(selection.focusNode));
      const hasSelectionInPdf = hasValidSelection && anchorInPdf && focusInPdf;

      if (anchorInPdf && focusInPdf && hasSelectionInPdf) {
        setSelectingTextFlag(true, 'pointerup-valid-selection');
        textSelectionActivatedAtRef.current = Date.now();
      } else {
        setSelectingTextFlag(false, 'pointerup-invalid-selection');
        textSelectionActivatedAtRef.current = null;
        startedInsidePdfRef.current = false;
      }

      scheduleSelectionSafetyReset('pointerup');

      isPointerDownInPdfRef.current = false;
      hasDragRef.current = false;
    };

    document.addEventListener('selectionchange', updateSelectionStateFromDom);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('selectionchange', updateSelectionStateFromDom);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      if (textSelectionSafetyTimeoutRef.current) {
        clearTimeout(textSelectionSafetyTimeoutRef.current);
        textSelectionSafetyTimeoutRef.current = null;
      }

      if (pointerDownSafetyTimeoutRef.current) {
        clearTimeout(pointerDownSafetyTimeoutRef.current);
        pointerDownSafetyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!isSelectingTextRef.current || isPointerDownRef.current) {
        return;
      }

      const selectionActivatedAt = textSelectionActivatedAtRef.current;
      if (!selectionActivatedAt) {
        if (isSelectingTextRef.current) {
          logger.info('DEBUG TEMP isSelectingTextRef true -> false', 'FloatingPDFViewer.textSelectionGuards', {
            reason: 'stale-selection-without-activation'
          });
        }
        isSelectingTextRef.current = false;
        return;
      }

      if (Date.now() - selectionActivatedAt > TEXT_SELECTION_STALE_RESET_MS) {
        if (isSelectingTextRef.current) {
          logger.info('DEBUG TEMP isSelectingTextRef true -> false', 'FloatingPDFViewer.textSelectionGuards', {
            reason: 'stale-selection-interval-timeout'
          });
        }
        isSelectingTextRef.current = false;
        textSelectionActivatedAtRef.current = null;
        startedInsidePdfRef.current = false;
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  /**
   * Effect para preload imediato de páginas vizinhas + cache de páginas visitadas
   * V4: Preload imediato via CONTINUOUS_PRELOAD_RADIUS e idle até CONTINUOUS_IDLE_PRELOAD_RADIUS
   * Cache mantém últimas 10 páginas visitadas para navegação rápida
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous') return;

    setVisitedPages(prev => {
      const newSet = new Set(prev);
      newSet.add(state.currentPage);

      while (newSet.size > 10) {
        let farthestPage: number | null = null;
        let farthestDist = -1;
        for (const page of newSet) {
          if (page === state.currentPage) continue;
          const dist = Math.abs(page - state.currentPage);
          if (dist > farthestDist) {
            farthestDist = dist;
            farthestPage = page;
          }
        }
        if (farthestPage !== null) {
          newSet.delete(farthestPage);
        } else {
          break;
        }
      }

      return newSet;
    });

    const immediatePagesToPreload = new Set<number>();
    for (let offset = -CONTINUOUS_PRELOAD_RADIUS; offset <= CONTINUOUS_PRELOAD_RADIUS; offset++) {
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

      for (let offset = -CONTINUOUS_IDLE_PRELOAD_RADIUS; offset <= CONTINUOUS_IDLE_PRELOAD_RADIUS; offset++) {
        if (Math.abs(offset) > CONTINUOUS_PRELOAD_RADIUS) {
          const page = state.currentPage + offset;
          if (page >= 1 && page <= state.totalPages) {
            additionalPages.add(page);
          }
        }
      }

      const combined = new Set([...immediatePagesToPreload, ...additionalPages]);
      setIdlePages(combined);
    });

    setIdlePages(immediatePagesToPreload);

    return () => {
      if (idleCallbackIdRef.current) {
        cancelIdleCallback(idleCallbackIdRef.current);
      }
    };
  }, [state.currentPage, state.totalPages, state.viewMode]);

  const extractBookmarksForDocument = useCallback(async (documentId: string, signal: AbortSignal) => {
    if (signal.aborted || bookmarkExtractionInFlightRef.current.has(documentId) || bookmarkExtractionLoadedRef.current.has(documentId)) {
      return;
    }

    const pdf = pdfDocumentProxies.get(documentId);
    const proxyGeneration = proxyGenerationByDocumentRef.current.get(documentId);
    const isProxyFresh = Boolean(pdf) && proxyGeneration === documentSetGenerationRef.current;
    const documentIndex = state.documents.findIndex(doc => doc.id === documentId);
    const currentDoc = state.documents[documentIndex];

    logger.info(
      `Bookmark extraction proxy source = ${isProxyFresh ? 'fresh' : 'stale'}`,
      'FloatingPDFViewer.extractBookmarksForDocument',
      {
        documentId,
        hasProxy: Boolean(pdf),
        proxyGeneration,
        currentGeneration: documentSetGenerationRef.current,
        loadedAfterOnDocumentLoadSuccess: loadedDocumentRefsByGenerationRef.current.has(documentId)
      }
    );

    if (!pdf || !currentDoc || documentIndex < 0 || !isProxyFresh || !loadedDocumentRefsByGenerationRef.current.has(documentId)) {
      return;
    }

    bookmarkExtractionInFlightRef.current.add(documentId);
    setBookmarkStatusByDoc(documentId, 'loading');
    startPhaseTimer(`secondary-bookmarks-${documentId}`);

    const documentInfo: DocumentInfo = {
      documentId: currentDoc.id,
      documentIndex,
      documentName: currentDoc.displayName || currentDoc.fileName,
      pageOffset: 0
    };

    const cacheKey = generatePDFCacheKey(currentDoc.url, pdf.numPages, currentDoc.id);

    try {
      const cachedBookmarks = loadBookmarksFromCache(cacheKey);
      let bookmarks: any[];
      if (cachedBookmarks) {
        bookmarks = cachedBookmarks;
      } else {
        const extractFn = await lazyExtractBookmarks();
        bookmarks = await extractFn(pdf, documentInfo);
      }
      if (signal.aborted || !state.isOpen) {
        return;
      }

      if (!cachedBookmarks) {
        saveBookmarksToCache(cacheKey, bookmarks);
      }

      bookmarkExtractionLoadedRef.current.add(documentId);
      setBookmarkStatusByDoc(documentId, 'done');
      setDocumentBookmarks(prev => {
        const newMap = new Map(prev);
        newMap.set(currentDoc.id, {
          bookmarks,
          documentName: documentInfo.documentName,
          documentIndex: documentInfo.documentIndex,
          pageCount: pdf.numPages
        });
        setBookmarks(mergeBookmarksFromMultipleDocuments(newMap, { totalDocumentCount: state.documents.length }));
        return newMap;
      });

      finishPhaseTimer(`secondary-bookmarks-${documentId}`, 'FloatingPDFViewer.extractBookmarksForDocument', {
        documentId,
        bookmarkCount: bookmarks.length,
        fromCache: Boolean(cachedBookmarks)
      });
    } catch (error) {
      if (!signal.aborted) {
        bookmarkExtractionFailedRef.current.add(documentId);
        setBookmarkStatusByDoc(documentId, 'error');
        logger.warn(
          `Erro ao extrair bookmarks do documento "${documentInfo.documentName}"`,
          'FloatingPDFViewer.extractBookmarksForDocument',
          { documentId, error }
        );

        setDocumentBookmarks(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(currentDoc.id);
          if (!existing) {
            newMap.set(currentDoc.id, {
              bookmarks: [],
              documentName: documentInfo.documentName,
              documentIndex: documentInfo.documentIndex,
              pageCount: pdf.numPages
            });
          }
          setBookmarks(mergeBookmarksFromMultipleDocuments(newMap, { totalDocumentCount: state.documents.length }));
          return newMap;
        });
      }
    } finally {
      bookmarkExtractionInFlightRef.current.delete(documentId);

      const doneCount = bookmarkExtractionLoadedRef.current.size + bookmarkExtractionFailedRef.current.size;
      if (doneCount >= state.documents.length && bookmarkExtractionLoadedRef.current.size === 0) {
        setBookmarksError('Nenhum bookmark encontrado nos documentos');
      }
    }
  }, [pdfDocumentProxies, state.documents, state.isOpen, setBookmarkStatusByDoc, setBookmarks, setBookmarksError, startPhaseTimer, finishPhaseTimer]);

  const enqueueBookmarkExtraction = useCallback((prioritizedDocumentIds: string[]) => {
    prioritizedDocumentIds.forEach((documentId, index) => {
      if (bookmarkExtractionLoadedRef.current.has(documentId) || bookmarkExtractionInFlightRef.current.has(documentId)) {
        return;
      }

      enqueueHeavyTask({
        id: `bookmarks:${documentId}`,
        type: 'bookmarks',
        documentId,
        priority: 3000 - index,
        run: (signal) => extractBookmarksForDocument(documentId, signal)
      });
    });
  }, [enqueueHeavyTask, extractBookmarksForDocument]);


  /**
   * Handler quando PDF é carregado com sucesso
   * Fase crítica: registra metadados mínimos para liberar a primeira renderização rapidamente
   */
  const onDocumentLoadSuccess = useCallback((pdf: any, documentIndex: number) => {
    const { numPages } = pdf;
    const currentDoc = state.documents[documentIndex];
    if (!currentDoc) {
      return;
    }

    criticalDocStartTimesRef.current.set(currentDoc.id, performance.now());
    startPhaseTimer(`critical-load-${currentDoc.id}`);
    if (!phaseTimersRef.current.has('critical-first-page')) {
      startPhaseTimer('critical-first-page');
    }

    logger.success(
      `PDF carregado: ${currentDoc?.fileName || 'desconhecido'} com ${numPages} páginas (doc ${documentIndex + 1}/${state.documents.length})`,
      'FloatingPDFViewer.onDocumentLoadSuccess'
    );

    setPdfDocumentProxies(prev => {
      const newMap = new Map(prev);
      newMap.set(currentDoc.id, pdf);
      return newMap;
    });
    loadedDocumentRefsByGenerationRef.current.add(currentDoc.id);
    proxyGenerationByDocumentRef.current.set(currentDoc.id, documentSetGenerationRef.current);

    const currentExtraction = textExtractionAbortControllersRef.current.get(currentDoc.id);
    if (currentExtraction) {
      currentExtraction.abort();
      textExtractionAbortControllersRef.current.delete(currentDoc.id);
    }
    textExtractionProgressRef.current.delete(currentDoc.id);
    if (textExtractionProgressRef.current.size === 0) {
      setTextExtractionProgress(null);
    }

    setDocumentPages(prev => {
      const newMap = new Map(prev);
      newMap.set(currentDoc.id, numPages);
      return newMap;
    });

    setDocumentBookmarks(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(currentDoc.id)) {
        newMap.set(currentDoc.id, {
          bookmarks: [],
          documentName: currentDoc.displayName || currentDoc.fileName,
          documentIndex,
          pageCount: numPages
        });
      }
      return newMap;
    });

    finishPhaseTimer(`critical-load-${currentDoc.id}`, 'FloatingPDFViewer.onDocumentLoadSuccess', {
      documentId: currentDoc.id,
      numPages
    });
  }, [state.documents, setTextExtractionProgress, startPhaseTimer, finishPhaseTimer]);

  useEffect(() => {
    if (!state.isOpen || state.documents.length === 0 || pdfDocumentProxies.size === 0) {
      return;
    }

    const activeDocument = getCurrentDocument();
    const visibleDocumentIds = Array.from(scrollBasedVisiblePages)
      .map(page => getDocumentByGlobalPage(page)?.id)
      .filter((id): id is string => Boolean(id));
    const prioritizedDocumentIds = [
      activeDocument?.id,
      ...visibleDocumentIds,
      ...state.documents.map(doc => doc.id)
    ].filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);

    if (state.isBookmarkPanelVisible && activeDocument?.id) {
      enqueueBookmarkExtraction([activeDocument.id, ...prioritizedDocumentIds]);
      return;
    }

    const cancelIdle = scheduleIdleTask(() => {
      enqueueBookmarkExtraction(prioritizedDocumentIds);
    });

    return () => {
      cancelIdle();
    };
  }, [state.isOpen, state.documents, state.isBookmarkPanelVisible, pdfDocumentProxies, scrollBasedVisiblePages, getCurrentDocument, getDocumentByGlobalPage, enqueueBookmarkExtraction, scheduleIdleTask]);

  useEffect(() => {
    if (!state.isOpen) {
      commentsLoadStartedRef.current = false;
      commentsLoadedDocsRef.current.clear();
      commentsLoadInFlightRef.current.clear();
      commentsByDocumentRef.current.clear();
      setComments([]);
      return;
    }

    if (!firstPaintRecordedRef.current || commentsLoadStartedRef.current || state.documents.length === 0) {
      return;
    }

    commentsLoadStartedRef.current = true;
    startPhaseTimer('tertiary-comments-after-first-paint');

    const runAfterPaint = () => {
      const activeDocument = getCurrentDocument();
      const visibleDocumentIds = Array.from(scrollBasedVisiblePages)
        .map(page => getDocumentByGlobalPage(page)?.id)
        .filter((id): id is string => Boolean(id));
      const prioritizedDocumentIds = [
        activeDocument?.id,
        ...visibleDocumentIds,
        ...state.documents.map(doc => doc.id)
      ].filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);

      enqueueCommentsLoad(prioritizedDocumentIds);
      finishPhaseTimer('tertiary-comments-after-first-paint', 'FloatingPDFViewer.commentsPostPaint', {
        prioritizedDocuments: prioritizedDocumentIds.length
      });
    };

    const frameId = window.requestAnimationFrame(() => {
      commentsBatchTimeoutRef.current = setTimeout(runAfterPaint, 0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (commentsBatchTimeoutRef.current) {
        clearTimeout(commentsBatchTimeoutRef.current);
        commentsBatchTimeoutRef.current = null;
      }
    };
  }, [state.isOpen, state.documents, scrollBasedVisiblePages, getCurrentDocument, getDocumentByGlobalPage, enqueueCommentsLoad, setComments, startPhaseTimer, finishPhaseTimer]);

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

  const extractionProgressRafRef = useRef<number | null>(null);

  const recalcExtractionProgress = useCallback(() => {
    if (extractionProgressRafRef.current !== null) return;

    extractionProgressRafRef.current = requestAnimationFrame(() => {
      extractionProgressRafRef.current = null;

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
    });
  }, [setTextExtractionProgress]);

  const recalcExtractionProgressSync = useCallback(() => {
    if (extractionProgressRafRef.current !== null) {
      cancelAnimationFrame(extractionProgressRafRef.current);
      extractionProgressRafRef.current = null;
    }

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
  }, [setTextExtractionProgress]);

  const updateExtractionProgress = useCallback((documentId: string, current: number, total: number) => {
    textExtractionProgressRef.current.set(documentId, { current, total });
    recalcExtractionProgress();
  }, [recalcExtractionProgress]);

  const abortTextExtraction = useCallback((documentId?: string) => {
    if (documentId) {
      const controller = textExtractionAbortControllersRef.current.get(documentId);
      if (controller) {
        controller.abort();
      }
      textExtractionAbortControllersRef.current.delete(documentId);
      textExtractionProgressRef.current.delete(documentId);
      recalcExtractionProgressSync();
      return;
    }

    textExtractionAbortControllersRef.current.forEach(controller => controller.abort());
    textExtractionAbortControllersRef.current.clear();
    textExtractionProgressRef.current.clear();
    recalcExtractionProgressSync();
  }, [recalcExtractionProgressSync]);

  const startLazyTextExtraction = useCallback(() => {
    const shouldExtract = state.isSearchOpen || state.searchQuery.trim().length > 0;
    if (!shouldExtract || pdfDocumentProxies.size === 0) {
      return;
    }

    pdfDocumentProxies.forEach((pdf, documentId) => {
      if (textExtractionAbortControllersRef.current.has(documentId)) {
        return;
      }

      const offsets = memoizedDocumentOffsets.get(documentId);
      const visibleLocalPages = offsets
        ? Array.from(scrollBasedVisiblePages)
          .filter(page => page >= offsets.startPage && page <= offsets.endPage)
          .map(page => page - offsets.startPage + 1)
        : [];

      const currentLocalPage = offsets && state.currentPage >= offsets.startPage && state.currentPage <= offsets.endPage
        ? state.currentPage - offsets.startPage + 1
        : 1;

      const controller = new AbortController();
      textExtractionAbortControllersRef.current.set(documentId, controller);
      updateExtractionProgress(documentId, 0, pdf.numPages);

      lazyExtractAllPagesText().then(extractFn =>
        extractFn(
          pdf,
          documentId,
          (current, total) => updateExtractionProgress(documentId, current, total),
          controller.signal,
          {
            priorityPages: [currentLocalPage, ...visibleLocalPages],
            progressIntervalPages: 4
          }
        )
      ).then(() => {
        textExtractionAbortControllersRef.current.delete(documentId);
        textExtractionProgressRef.current.delete(documentId);
        recalcExtractionProgressSync();
      }).catch((error) => {
        textExtractionAbortControllersRef.current.delete(documentId);
        textExtractionProgressRef.current.delete(documentId);
        recalcExtractionProgressSync();

        logger.warn(
          `Falha na extração lazy de texto do documento ${documentId}`,
          error,
          'FloatingPDFViewer.startLazyTextExtraction'
        );
      });
    });
  }, [state.isSearchOpen, state.searchQuery, pdfDocumentProxies, memoizedDocumentOffsets, scrollBasedVisiblePages, state.currentPage, updateExtractionProgress, recalcExtractionProgressSync]);

  useEffect(() => {
    startLazyTextExtraction();
  }, [startLazyTextExtraction]);

  useEffect(() => {
    if (!state.isOpen) {
      abortTextExtraction();
    }
  }, [state.isOpen, abortTextExtraction]);

  useEffect(() => {
    const activeDocumentIds = new Set(state.documents.map(doc => doc.id));
    Array.from(textExtractionAbortControllersRef.current.keys()).forEach(documentId => {
      if (!activeDocumentIds.has(documentId)) {
        abortTextExtraction(documentId);
      }
    });
  }, [state.documents, abortTextExtraction]);

  useEffect(() => {
    return () => {
      abortTextExtraction();
    };
  }, [abortTextExtraction]);

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

  const pageArraysByDocument = useMemo(() => {
    const arrays = new Map<string, number[]>();
    for (const doc of state.documents) {
      const numPages = documentPages.get(doc.id) || 0;
      if (numPages > 0) {
        const arr: number[] = [];
        for (let i = 1; i <= numPages; i++) {
          arr.push(i);
        }
        arrays.set(doc.id, arr);
      }
    }
    return arrays;
  }, [state.documents, documentPages]);

  const fallbackVisibleRangeFromScroll = scrollFallbackVisibleRange;

  const effectiveVisiblePages = useMemo(() => {
    if (scrollBasedVisiblePages.size > 0) {
      return scrollBasedVisiblePages;
    }

    if (!fallbackVisibleRangeFromScroll) {
      return new Set<number>();
    }

    const nextSet = new Set<number>();
    for (let page = fallbackVisibleRangeFromScroll.start; page <= fallbackVisibleRangeFromScroll.end; page += 1) {
      nextSet.add(page);
    }
    return nextSet;
  }, [fallbackVisibleRangeFromScroll, scrollBasedVisiblePages]);

  const continuousWindowByDocument = useMemo(() => {
    const windows = new Map<string, {
      firstVisibleLocalPage: number;
      lastVisibleLocalPage: number;
      rangeStart: number;
      rangeEnd: number;
    }>();

    state.documents.forEach((doc) => {
      const offset = memoizedDocumentOffsets.get(doc.id);
      if (!offset) {
        return;
      }

      const numPages = documentPages.get(doc.id) || offset.numPages;
      if (numPages <= 0) {
        return;
      }

      let firstVisibleLocalPage: number | null = null;
      let lastVisibleLocalPage: number | null = null;

      effectiveVisiblePages.forEach((globalPageNum) => {
        if (globalPageNum < offset.startPage || globalPageNum > offset.endPage) {
          return;
        }

        const localPageNum = globalPageNum - offset.startPage + 1;
        if (firstVisibleLocalPage === null || localPageNum < firstVisibleLocalPage) {
          firstVisibleLocalPage = localPageNum;
        }
        if (lastVisibleLocalPage === null || localPageNum > lastVisibleLocalPage) {
          lastVisibleLocalPage = localPageNum;
        }
      });

      const isCurrentPageInDocument = state.currentPage >= offset.startPage && state.currentPage <= offset.endPage;
      const localCurrentPage = isCurrentPageInDocument
        ? state.currentPage - offset.startPage + 1
        : null;

      if ((firstVisibleLocalPage === null || lastVisibleLocalPage === null) && fallbackVisibleRangeFromScroll) {
        const fallbackStart = Math.max(offset.startPage, fallbackVisibleRangeFromScroll.start);
        const fallbackEnd = Math.min(offset.endPage, fallbackVisibleRangeFromScroll.end);

        if (fallbackStart <= fallbackEnd) {
          firstVisibleLocalPage = fallbackStart - offset.startPage + 1;
          lastVisibleLocalPage = fallbackEnd - offset.startPage + 1;
        }
      }

      if (firstVisibleLocalPage === null || lastVisibleLocalPage === null) {
        if (localCurrentPage !== null) {
          firstVisibleLocalPage = localCurrentPage;
          lastVisibleLocalPage = localCurrentPage;
        } else {
          firstVisibleLocalPage = 1;
          lastVisibleLocalPage = 1;
        }
      }

      if (localCurrentPage !== null) {
        const isCurrentNearVisibleWindow =
          localCurrentPage >= firstVisibleLocalPage - CONTINUOUS_WINDOW_BUFFER_PAGES &&
          localCurrentPage <= lastVisibleLocalPage + CONTINUOUS_WINDOW_BUFFER_PAGES;

        if (!isCurrentNearVisibleWindow) {
          firstVisibleLocalPage = localCurrentPage;
          lastVisibleLocalPage = localCurrentPage;
        }
      }

      const rangeStart = Math.max(1, firstVisibleLocalPage - CONTINUOUS_WINDOW_BUFFER_PAGES);
      const rangeEnd = Math.min(numPages, lastVisibleLocalPage + CONTINUOUS_WINDOW_BUFFER_PAGES);

      windows.set(doc.id, {
        firstVisibleLocalPage,
        lastVisibleLocalPage,
        rangeStart,
        rangeEnd
      });
    });

    return windows;
  }, [state.documents, state.currentPage, memoizedDocumentOffsets, documentPages, effectiveVisiblePages, fallbackVisibleRangeFromScroll]);

  const continuousGlobalVisibleRange = useMemo(() => {
    if (state.viewMode !== 'continuous' || state.totalPages <= 0) {
      return null;
    }

    if (fallbackVisibleRangeFromScroll) {
      return {
        start: Math.max(1, Math.min(state.totalPages, fallbackVisibleRangeFromScroll.start)),
        end: Math.max(1, Math.min(state.totalPages, fallbackVisibleRangeFromScroll.end))
      };
    }

    const refStart = visibleStartPageRef.current;
    const refEnd = visibleEndPageRef.current;
    const hasValidRefRange = refStart >= 1 && refEnd >= refStart && refEnd <= state.totalPages;

    if (hasValidRefRange) {
      return {
        start: refStart,
        end: refEnd
      };
    }

    const fallbackPage = Math.min(state.totalPages, Math.max(1, state.currentPage));
    return {
      start: fallbackPage,
      end: fallbackPage
    };
  }, [state.viewMode, state.totalPages, state.currentPage, fallbackVisibleRangeFromScroll]);

  const continuousCanvasPipeline = useMemo(() => {
    if (state.viewMode !== 'continuous') {
      return {
        pagesByDocument: new Map<string, Set<number>>(),
        activeDocumentId: null as string | null,
        visibleDocumentIds: new Set<string>()
      };
    }

    // Arquitetura (fonte única):
    // 1) calcular faixa visível global
    // 2) distribuir orçamento por documento ativo/inativo
    // 3) produzir o conjunto final continuousCanvasPagesByDocument
    // pagesToRender deve ser usado apenas para mount/preload (nunca como decisão primária de canvas).
    const fallbackPage = Math.min(Math.max(state.totalPages, 1), Math.max(1, state.currentPage));
    const globalRange = continuousGlobalVisibleRange || {
      start: fallbackPage,
      end: fallbackPage
    };
    const overscanPages = 2;
    const pagesByDocument = new Map<string, Set<number>>();
    const visibleDocumentIds = new Set<string>();

    let activeDocumentId: string | null = null;
    const visibleAnchorPage = Math.min(
      state.totalPages,
      Math.max(1, Math.round((globalRange.start + globalRange.end) / 2))
    );

    for (const doc of state.documents) {
      const offset = memoizedDocumentOffsets.get(doc.id);
      if (offset && visibleAnchorPage >= offset.startPage && visibleAnchorPage <= offset.endPage) {
        activeDocumentId = doc.id;
        break;
      }
    }

    if (!activeDocumentId) {
      for (const doc of state.documents) {
        const offset = memoizedDocumentOffsets.get(doc.id);
        if (offset && state.currentPage >= offset.startPage && state.currentPage <= offset.endPage) {
          activeDocumentId = doc.id;
          break;
        }
      }
    }

    state.documents.forEach((doc) => {
      const offset = memoizedDocumentOffsets.get(doc.id);
      const pageWindow = continuousWindowByDocument.get(doc.id);

      if (!offset || !pageWindow) {
        return;
      }

      const hasVisibleIntersection = globalRange.start <= offset.endPage && globalRange.end >= offset.startPage;
      if (hasVisibleIntersection) {
        visibleDocumentIds.add(doc.id);
      }

      const { rangeStart, rangeEnd } = pageWindow;
      const isActiveDocument = activeDocumentId === doc.id;

      if (rangeStart > rangeEnd) {
        pagesByDocument.set(doc.id, new Set<number>());
        return;
      }

      const windowStartGlobal = offset.startPage + rangeStart - 1;
      const windowEndGlobal = offset.startPage + rangeEnd - 1;
      const fallbackAnchorGlobal = isActiveDocument
        ? state.currentPage
        : Math.min(offset.endPage, Math.max(offset.startPage, Math.round((globalRange.start + globalRange.end) / 2)));

      const baseStartGlobalRaw = Math.max(offset.startPage, globalRange.start);
      const baseEndGlobalRaw = Math.min(offset.endPage, globalRange.end);
      const hasBaseInDocument = baseStartGlobalRaw <= baseEndGlobalRaw;

      const baseStartGlobal = hasBaseInDocument
        ? Math.max(windowStartGlobal, baseStartGlobalRaw)
        : Math.min(windowEndGlobal, Math.max(windowStartGlobal, fallbackAnchorGlobal));
      const baseEndGlobal = hasBaseInDocument
        ? Math.min(windowEndGlobal, baseEndGlobalRaw)
        : Math.min(windowEndGlobal, Math.max(windowStartGlobal, fallbackAnchorGlobal));

      const selectedPagesGlobal = new Set<number>();
      const optionalPagesGlobal: number[] = [];

      // Núcleo obrigatório: manter 100% das páginas visíveis no viewport para este documento.
      for (let globalPage = baseStartGlobal; globalPage <= baseEndGlobal; globalPage += 1) {
        selectedPagesGlobal.add(globalPage);
      }

      // Camada opcional: overscan/preload em torno do núcleo.
      for (let i = 1; i <= overscanPages; i += 1) {
        const beforePage = baseStartGlobal - i;
        const afterPage = baseEndGlobal + i;

        if (beforePage >= windowStartGlobal) {
          optionalPagesGlobal.push(beforePage);
        }

        if (afterPage <= windowEndGlobal) {
          optionalPagesGlobal.push(afterPage);
        }
      }

      const viewportPageCount = Math.max(1, baseEndGlobal - baseStartGlobal + 1);
      const optionalBudget = hasVisibleIntersection
        ? Math.max(
          overscanPages * 2,
          isActiveDocument
            ? CONTINUOUS_RENDER_BUDGET_PAGES + Math.ceil(viewportPageCount / 2)
            : Math.ceil(viewportPageCount / 2)
        )
        : CONTINUOUS_INACTIVE_DOCUMENT_RENDER_BUDGET_PAGES;

      for (const globalPage of optionalPagesGlobal) {
        if (selectedPagesGlobal.size >= viewportPageCount + optionalBudget) {
          break;
        }

        selectedPagesGlobal.add(globalPage);
      }

      const windowStartGlobalForced = offset.startPage + rangeStart - 1;
      const windowEndGlobalForced = offset.startPage + rangeEnd - 1;
      for (let globalPage = windowStartGlobalForced; globalPage <= windowEndGlobalForced; globalPage++) {
        selectedPagesGlobal.add(globalPage);
      }

      const selectedPages = new Set<number>();
      selectedPagesGlobal.forEach((globalPage) => {
        selectedPages.add(globalPage - offset.startPage + 1);
      });

      pagesByDocument.set(doc.id, selectedPages);
    });

    return {
      pagesByDocument,
      activeDocumentId,
      visibleDocumentIds
    };
  }, [
    state.viewMode,
    state.documents,
    state.currentPage,
    state.totalPages,
    memoizedDocumentOffsets,
    continuousWindowByDocument,
    continuousGlobalVisibleRange
  ]);

  useEffect(() => {
    if (state.viewMode !== 'continuous' || !continuousGlobalVisibleRange) {
      currentPageVisibleDivergenceStartedAtRef.current = null;
      return;
    }

    const now = Date.now();
    const { start, end } = continuousGlobalVisibleRange;
    const distanceToVisibleRange = state.currentPage < start
      ? start - state.currentPage
      : state.currentPage > end
        ? state.currentPage - end
        : 0;

    if (distanceToVisibleRange < CURRENT_PAGE_VISIBLE_DIVERGENCE_THRESHOLD_PAGES) {
      currentPageVisibleDivergenceStartedAtRef.current = null;
      return;
    }

    if (currentPageVisibleDivergenceStartedAtRef.current === null) {
      currentPageVisibleDivergenceStartedAtRef.current = now;
      return;
    }

    const divergenceDurationMs = now - currentPageVisibleDivergenceStartedAtRef.current;
    if (divergenceDurationMs >= 500 && now - currentPageVisibleDivergenceLastLogAtRef.current >= 500) {
      currentPageVisibleDivergenceLastLogAtRef.current = now;
      logger.info(
        'Métrica: currentPage divergente do range visível por mais de 500ms',
        'FloatingPDFViewer.currentPageVisibleDivergence',
        {
          currentPage: state.currentPage,
          visibleStart: start,
          visibleEnd: end,
          distanceToVisibleRange,
          divergenceDurationMs,
          usedFallbackVisibleRange: Boolean(fallbackVisibleRangeFromScroll)
        }
      );
    }
  }, [state.viewMode, state.currentPage, continuousGlobalVisibleRange, fallbackVisibleRangeFromScroll]);

  const continuousCanvasPagesByDocument = useMemo(() => {
    const pagesByDocument = continuousCanvasPipeline.pagesByDocument;

    if (DEBUG_CONTINUOUS_RENDER && state.viewMode === 'continuous') {
      const documents = state.documents.map((doc) => {
        const selectedPages = Array.from(pagesByDocument.get(doc.id) || []).sort((a, b) => a - b);
        return {
          documentId: doc.id,
          isActiveDocument: continuousCanvasPipeline.activeDocumentId === doc.id,
          selectedPagesCount: selectedPages.length,
          selectedPagesMin: selectedPages.length > 0 ? selectedPages[0] : null,
          selectedPagesMax: selectedPages.length > 0 ? selectedPages[selectedPages.length - 1] : null
        };
      });

      logger.info(
        'Depuração do cálculo de continuousCanvasPagesByDocument',
        'FloatingPDFViewer.continuousCanvasPagesByDocument',
        {
          visibleStartPage: visibleStartPageRef.current,
          visibleEndPage: visibleEndPageRef.current,
          budget: {
            active: CONTINUOUS_RENDER_BUDGET_PAGES,
            inactive: CONTINUOUS_INACTIVE_DOCUMENT_RENDER_BUDGET_PAGES
          },
          documents
        }
      );
    }

    return pagesByDocument;
  }, [continuousCanvasPipeline, state.viewMode, state.documents]);

  const pagesToRender = useMemo(() => {
    if (state.viewMode !== 'continuous') return new Set<number>();

    const candidatePriority = new Map<number, number>();
    const viewportCorePages = new Set<number>();
    const pushCandidate = (page: number, priority: number) => {
      if (page < 1 || page > state.totalPages) {
        return;
      }

      const existingPriority = candidatePriority.get(page);
      if (existingPriority === undefined || priority < existingPriority) {
        candidatePriority.set(page, priority);
      }
    };

    if (continuousGlobalVisibleRange) {
      for (let page = continuousGlobalVisibleRange.start; page <= continuousGlobalVisibleRange.end; page += 1) {
        viewportCorePages.add(page);
        pushCandidate(page, -1);
      }
    }

    // 1) Prioridade máxima: páginas visíveis no viewport atual
    effectiveVisiblePages.forEach((page) => {
      pushCandidate(page, 0);
    });

    // 2) Páginas do documento ativo no pipeline contínuo
    const activeDocumentId = continuousCanvasPipeline.activeDocumentId;
    if (activeDocumentId) {
      const activePages = continuousCanvasPipeline.pagesByDocument.get(activeDocumentId);
      const offset = memoizedDocumentOffsets.get(activeDocumentId);
      if (activePages && offset) {
        activePages.forEach((localPage) => {
          pushCandidate(offset.startPage + localPage - 1, 1);
        });
      }
    }

    // 3) Centro visível derivado do scroll ± 1
    const scrollBasedCenter = Math.round((visibleStartPageRef.current + visibleEndPageRef.current) / 2);
    const centerPage = scrollBasedCenter >= 1 && scrollBasedCenter <= state.totalPages
      ? scrollBasedCenter
      : state.currentPage;
    for (let i = -1; i <= 1; i += 1) {
      pushCandidate(centerPage + i, 2);
    }

    // 4) Páginas forçadas
    forceRenderPages.forEach((page) => {
      pushCandidate(page, 3);
    });

    // 5) Restante do cache
    scrollRenderCache.forEach((page) => {
      pushCandidate(page, 4);
    });

    const visibleCenter = (visibleStartPageRef.current + visibleEndPageRef.current) / 2;
    const rankedCandidates = Array.from(candidatePriority.entries())
      .map(([page, priority]) => ({
        page,
        priority,
        distanceToVisibleCenter: Math.abs(page - visibleCenter)
      }))
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        if (a.distanceToVisibleCenter !== b.distanceToVisibleCenter) {
          return a.distanceToVisibleCenter - b.distanceToVisibleCenter;
        }
        return a.page - b.page;
      });

    if (rankedCandidates.length > CONTINUOUS_RENDER_BUDGET_PAGES) {
      const selectedPages = new Set<number>(viewportCorePages);

      for (const candidate of rankedCandidates) {
        if (selectedPages.has(candidate.page)) {
          continue;
        }
        if (selectedPages.size >= CONTINUOUS_RENDER_BUDGET_PAGES && viewportCorePages.size <= CONTINUOUS_RENDER_BUDGET_PAGES) {
          break;
        }
        selectedPages.add(candidate.page);
      }

      return selectedPages;
    }

    return new Set<number>(rankedCandidates.map((candidate) => candidate.page));
  }, [state.viewMode, state.currentPage, state.totalPages, continuousCanvasPipeline, continuousGlobalVisibleRange, memoizedDocumentOffsets, effectiveVisiblePages, scrollRenderCache, forceRenderPages]);

  const currentPageInfo = useMemo(() => {
    if (state.viewMode !== 'paginated' || state.totalPages === 0) return null;
    const offsets = memoizedDocumentOffsets;
    for (const [docIndex, doc] of state.documents.entries()) {
      const offset = offsets.get(doc.id);
      if (offset && state.currentPage >= offset.startPage && state.currentPage <= offset.endPage) {
        return {
          document: doc,
          documentIndex: docIndex,
          localPage: state.currentPage - offset.startPage + 1,
          offset: offset
        };
      }
    }
    return null;
  }, [state.viewMode, state.currentPage, state.totalPages, state.documents, memoizedDocumentOffsets]);

  const documentsToMountInContinuous = useMemo(() => {
    if (state.viewMode !== 'continuous') {
      return new Set<number>();
    }

    const now = Date.now();
    const baseDocumentIndices = new Set<number>();
    state.documents.forEach((doc, docIndex) => {
      if (continuousCanvasPipeline.visibleDocumentIds.has(doc.id) || continuousCanvasPipeline.activeDocumentId === doc.id) {
        baseDocumentIndices.add(docIndex);
      }
    });

    if (baseDocumentIndices.size === 0) {
      for (const globalPage of pagesToRender) {
        for (const [docIndex, doc] of state.documents.entries()) {
          const offset = memoizedDocumentOffsets.get(doc.id);
          if (offset && globalPage >= offset.startPage && globalPage <= offset.endPage) {
            baseDocumentIndices.add(docIndex);
            break;
          }
        }
      }
    }

    const expandedWindowIndices = new Set<number>();
    baseDocumentIndices.forEach((docIndex) => {
      for (let i = -1; i <= 1; i++) {
        const index = docIndex + i;
        if (index >= 0 && index < state.documents.length) {
          expandedWindowIndices.add(index);
        }
      }
    });

    const hysteresisWindowIndices = new Set<number>(expandedWindowIndices);
    state.documents.forEach((doc, docIndex) => {
      if (expandedWindowIndices.has(docIndex)) {
        documentMountLastSeenAtRef.current.set(doc.id, now);
        return;
      }

      const lastSeenAt = documentMountLastSeenAtRef.current.get(doc.id);
      if (lastSeenAt && now - lastSeenAt <= DOCUMENT_MOUNT_HYSTERESIS_TTL_MS) {
        hysteresisWindowIndices.add(docIndex);
      }
    });

    return hysteresisWindowIndices;
  }, [state.viewMode, state.documents, memoizedDocumentOffsets, continuousCanvasPipeline, pagesToRender]);

  useEffect(() => {
    if (state.viewMode !== 'continuous') {
      previouslyMountedDocumentsRef.current.clear();
      return;
    }

    const now = Date.now();
    const currentMountedDocuments = new Set<string>();

    state.documents.forEach((doc, docIndex) => {
      if (documentsToMountInContinuous.has(docIndex)) {
        currentMountedDocuments.add(doc.id);
      }
    });

    currentMountedDocuments.forEach((docId) => {
      const wasMounted = previouslyMountedDocumentsRef.current.has(docId);
      const lastSeenAt = documentMountLastSeenAtRef.current.get(docId);
      const isRemountWithinTtl = !wasMounted && Boolean(lastSeenAt) && (now - (lastSeenAt || 0) <= DOCUMENT_MOUNT_HYSTERESIS_TTL_MS);

      if (isRemountWithinTtl) {
        offsetRebuildBlockUntilRef.current = Math.max(
          offsetRebuildBlockUntilRef.current,
          now + DOCUMENT_REMOUNT_RECONCILIATION_BLOCK_MS
        );
        centerPageFreezeUntilRef.current = Math.max(
          centerPageFreezeUntilRef.current,
          now + DOCUMENT_REMOUNT_CENTER_FREEZE_MS
        );
      }
    });

    previouslyMountedDocumentsRef.current = currentMountedDocuments;
  }, [state.viewMode, state.documents, documentsToMountInContinuous]);

  const estimatedDocumentHeights = useMemo(() => {
    const heights = new Map<string, number>();

    state.documents.forEach((doc, docIndex) => {
      const offset = memoizedDocumentOffsets.get(doc.id);
      const loadedPages = documentPages.get(doc.id) || 0;
      const pageCount = loadedPages || (offset ? (offset.endPage - offset.startPage + 1) : 1);
      const confirmedHeight = documentConfirmedHeightsRef.current.get(doc.id);
      const isDocumentMounted = state.viewMode !== 'continuous' || documentsToMountInContinuous.has(docIndex);

      if (!offset || pageCount <= 0) {
        heights.set(doc.id, confirmedHeight || 920);
        return;
      }

      let totalHeight = 0;
      for (let localPage = 1; localPage <= pageCount; localPage++) {
        const globalPage = offset.startPage + localPage - 1;
        totalHeight += getPageHeight(globalPage);
      }

      const gapHeight = Math.max(pageCount - 1, 0) * CONTINUOUS_PAGE_GAP_PX;
      const computedHeight = Math.max(920, totalHeight + gapHeight);

      if (isDocumentMounted) {
        documentConfirmedHeightsRef.current.set(doc.id, computedHeight);
        heights.set(doc.id, computedHeight);
        return;
      }

      heights.set(doc.id, confirmedHeight || computedHeight);
    });

    return heights;
  }, [state.documents, state.viewMode, memoizedDocumentOffsets, documentPages, documentsToMountInContinuous, getPageHeight]);

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

  const extractionTarget = useMemo(() => {
    const targetByGlobalPage = findDocumentByGlobalPage(state.currentPage);
    if (targetByGlobalPage) {
      return targetByGlobalPage;
    }

    return null;
  }, [findDocumentByGlobalPage, state.currentPage]);

  const extractionSourceDocuments = useMemo(() => {
    return state.documents
      .map((doc) => {
        const offsets = memoizedDocumentOffsets.get(doc.id);
        if (!offsets || !doc.url) {
          return null;
        }

        const pageCount = documentPages.get(doc.id)
          || Math.max(0, offsets.endPage - offsets.startPage + 1);

        if (pageCount <= 0) {
          return null;
        }

        return {
          documentId: doc.id,
          documentName: doc.displayName || doc.fileName || 'documento.pdf',
          url: doc.url,
          globalStart: offsets.startPage,
          globalEnd: offsets.endPage,
          pageCount,
        };
      })
      .filter(Boolean) as {
        documentId: string;
        documentName: string;
        url: string;
        globalStart: number;
        globalEnd: number;
        pageCount: number;
      }[];
  }, [state.documents, memoizedDocumentOffsets, documentPages]);

  /**
   * Handler para navegação manual de página (input direto)
   * Sincroniza as referências de detecção para evitar conflitos
   */
  const handleManualPageNavigation = useCallback((pageNum: number) => {
    if (state.viewMode === 'continuous') {
      startProgrammaticPageNavigation(pageNum, 'manual', true);
      return;
    }

    goToPage(pageNum);
  }, [goToPage, startProgrammaticPageNavigation, state.viewMode]);

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
    if (selectionMode === 'native-drag') {
      return;
    }

    const selection = window.getSelection();
    const selectedText = extractTextFromSelection(selection);

    if (!selectedText || selectedText.length < 3) {
      return;
    }

    if (!startedInsidePdfRef.current) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const anchorNode = selection?.anchorNode;
    const focusNode = selection?.focusNode;
    if (!anchorNode || !focusNode) {
      return;
    }
    if (!scrollContainer.contains(anchorNode) && !scrollContainer.contains(focusNode)) {
      return;
    }

    try {
      const range = selection?.getRangeAt(0);
      if (!range) return;

      if (!scrollContainer.contains(range.commonAncestorContainer)) {
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
        registerContextCommit();
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

      registerContextCommit();
      setSelectedText(selectedText, position);

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
      registerContextCommit();
      setSelectedText(selectedText);
      startedInsidePdfRef.current = false;
    }
  }, [registerContextCommit, selectionMode, setSelectedText, state.currentPage, state.zoom, state.displayZoom]);

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
    const debouncedTextSelection = () => {
      if (textSelectionDebounceRef.current) {
        clearTimeout(textSelectionDebounceRef.current);
      }
      textSelectionDebounceRef.current = setTimeout(() => {
        const hasTextSelected = (window.getSelection()?.toString() || '').trim().length >= 3;
        if (selectionMode !== 'native-drag' || hasTextSelected) {
          handleTextSelection();
        }
      }, 150);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
        const selection = window.getSelection();
        const text = selection?.toString() || '';
        if (text.length >= 3) {
          const scrollContainer = scrollContainerRef.current;
          if (scrollContainer && selection?.anchorNode && scrollContainer.contains(selection.anchorNode)) {
            startedInsidePdfRef.current = true;
            debouncedTextSelection();
          }
        }
      }
    };

    document.addEventListener('mouseup', debouncedTextSelection);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('mouseup', debouncedTextSelection);
      document.removeEventListener('keyup', handleKeyUp);
      if (textSelectionDebounceRef.current) {
        clearTimeout(textSelectionDebounceRef.current);
      }
    };
  }, [handleTextSelection, selectionMode]);

  useEffect(() => {
    if (!hasSelection || selectionMode === 'native-drag') {
      return;
    }

    handleTextSelection();
  }, [hasSelection, handleTextSelection, selectionMode]);

  /**
   * Wrappers para navegação de página com bloqueio durante rotação
   * CORREÇÃO: Define isProgrammaticScrollRef ANTES de atualizar estado
   * para evitar condição de corrida com a detecção de scroll
   */
  const handlePreviousPage = useCallback(() => {
    if (state.isRotating) return;
    if (state.currentPage <= 1) return;

    if (state.viewMode === 'continuous') {
      const targetPage = state.currentPage - 1;
      keyboardNavTargetPageRef.current = targetPage;
      keyboardNavRecentTargetPageRef.current = targetPage;
      keyboardNavLockUntilRef.current = Date.now() + KEYBOARD_NAV_LOCK_DURATION_MS;
      keyboardNavTargetReachedAtRef.current = null;
      keyboardNavStableFramesRef.current = 0;
      markProgrammaticScroll('state-change');
    }
    previousPage();
  }, [markProgrammaticScroll, previousPage, state.isRotating, state.currentPage, state.viewMode]);

  const handleNextPage = useCallback(() => {
    if (state.isRotating) return;
    if (state.currentPage >= state.totalPages) return;

    if (state.viewMode === 'continuous') {
      const targetPage = state.currentPage + 1;
      keyboardNavTargetPageRef.current = targetPage;
      keyboardNavRecentTargetPageRef.current = targetPage;
      keyboardNavLockUntilRef.current = Date.now() + KEYBOARD_NAV_LOCK_DURATION_MS;
      keyboardNavTargetReachedAtRef.current = null;
      keyboardNavStableFramesRef.current = 0;
      markProgrammaticScroll('state-change');
    }
    nextPage();
  }, [markProgrammaticScroll, nextPage, state.isRotating, state.currentPage, state.totalPages, state.viewMode]);

  const handleToggleViewMode = useCallback(() => {
    isModeSwitchingRef.current = true;
    pageBeforeModeSwitchRef.current = state.currentPage;
    markProgrammaticScroll('state-change');
    lastDetectedPageRef.current = state.currentPage;
    lastDetectionTimeRef.current = Date.now();
    toggleViewMode();
    setTimeout(() => {
      releaseProgrammaticScroll('state-change');
      isModeSwitchingRef.current = false;
    }, 500);
  }, [markProgrammaticScroll, releaseProgrammaticScroll, toggleViewMode, state.currentPage]);

  useEffect(() => {
    handlePreviousPageRef.current = handlePreviousPage;
    handleNextPageRef.current = handleNextPage;
    handleManualPageNavigationRef.current = handleManualPageNavigation;
    toggleSearchRef.current = toggleSearch;
    currentPageRef.current = state.currentPage;
    totalPagesRef.current = state.totalPages;
    keyboardNavigationThrottleMsRef.current = state.viewMode === 'continuous' ? 90 : 130;
  }, [
    handlePreviousPage,
    handleNextPage,
    handleManualPageNavigation,
    state.currentPage,
    state.totalPages,
    state.viewMode,
    toggleSearch
  ]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (!hasMountedRef.current) return;

    const prevMode = prevViewModeRef.current;
    const currentMode = state.viewMode;

    if (prevMode === currentMode) return;

    prevViewModeRef.current = currentMode;

    if (currentMode === 'paginated' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    } else if (currentMode === 'continuous' && prevMode === 'paginated' && scrollContainerRef.current) {
      setIsModeTransitioning(true);
      markProgrammaticScroll('state-change');
      const targetPage = pageBeforeModeSwitchRef.current;
      let retryCount = 0;
      const MAX_RETRIES = 50;

      const scrollToTargetPage = () => {
        const pageElement = pageRefs.current.get(targetPage);
        if (pageElement && scrollContainerRef.current) {
          pageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
          requestAnimationFrame(() => {
            setIsModeTransitioning(false);
            setTimeout(() => {
              releaseProgrammaticScroll('state-change');
            }, 300);
          });
        } else if (retryCount < MAX_RETRIES) {
          retryCount++;
          setTimeout(scrollToTargetPage, 16);
        } else {
          setIsModeTransitioning(false);
          releaseProgrammaticScroll('state-change');
        }
      };

      scrollToTargetPage();
    }
  }, [markProgrammaticScroll, releaseProgrammaticScroll, state.viewMode]);

  /**
   * Effect para navegação por teclado com throttle para evitar navegação excessiva
   */
  useEffect(() => {
    const lastHandledRepeatByKey = new Map<string, number>();
    const pressedNavigationKeys = new Set<string>();
    const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown']);
    const KEYBOARD_LOG_CONTEXT = 'FloatingPDFViewer.handleKeyDown';

    const getKeyboardLogPayload = (key: string, elapsed: number, throttle: number) => ({
      key,
      elapsed,
      throttle,
      lockState: {
        targetPage: keyboardNavTargetPageRef.current,
        lockUntil: keyboardNavLockUntilRef.current,
        cooldownUntil: keyboardNavCooldownUntilRef.current,
        isLockActive: Date.now() < keyboardNavLockUntilRef.current,
        isCooldownActive: Date.now() < keyboardNavCooldownUntilRef.current,
        stableFrames: keyboardNavStableFramesRef.current
      },
      pendingTarget: pendingNavigationTargetRef.current
    });

    const handleKeyUp = (e: KeyboardEvent) => {
      if (NAVIGATION_KEYS.has(e.key)) {
        pressedNavigationKeys.delete(e.key);

        const now = Date.now();
        const elapsedSinceLastInput = now - keyboardNavLastInputAtRef.current;
        const hasRecentKeyboardNavigation = elapsedSinceLastInput <= KEYBOARD_NAV_LOCK_DURATION_MS * 2;
        const throttle = keyboardNavigationThrottleMsRef.current;

        if (hasRecentKeyboardNavigation) {
          keyboardNavCooldownUntilRef.current = now + KEYBOARD_NAV_COOLDOWN_DURATION_MS;
          keyboardNavStableFramesRef.current = 0;

          logger.info(
            'Keyboard navigation lock/cooldown release armed on keyup',
            KEYBOARD_LOG_CONTEXT,
            getKeyboardLogPayload(e.key, elapsedSinceLastInput, throttle)
          );
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearchRef.current();
        return;
      }

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        )
      ) {
        return;
      }

      const now = Date.now();
      const isNavigationKey = NAVIGATION_KEYS.has(e.key);

      if (isNavigationKey) {
        keyboardNavLastInputAtRef.current = now;
        const wasPressed = pressedNavigationKeys.has(e.key);
        pressedNavigationKeys.add(e.key);

        if (e.repeat || wasPressed) {
          const lastHandledAt = lastHandledRepeatByKey.get(e.key) ?? 0;
          const elapsed = now - lastHandledAt;
          const navigationThrottleMs = keyboardNavigationThrottleMsRef.current;

          if (elapsed < navigationThrottleMs) {
            logger.info(
              'Keyboard navigation throttled',
              KEYBOARD_LOG_CONTEXT,
              {
                ...getKeyboardLogPayload(e.key, elapsed, navigationThrottleMs),
                reason: 'repeat/hold interval too short',
                isRepeat: e.repeat,
                wasPressed
              }
            );
            e.preventDefault();
            return;
          }

          logger.info(
            'Keyboard navigation repeat/hold allowed',
            KEYBOARD_LOG_CONTEXT,
            {
              ...getKeyboardLogPayload(e.key, elapsed, navigationThrottleMs),
              isRepeat: e.repeat,
              wasPressed
            }
          );
          lastHandledRepeatByKey.set(e.key, now);
        } else {
          logger.info(
            'Keyboard navigation discrete tap allowed',
            KEYBOARD_LOG_CONTEXT,
            {
              ...getKeyboardLogPayload(e.key, 0, keyboardNavigationThrottleMsRef.current),
              isRepeat: e.repeat,
              wasPressed: false
            }
          );
        }
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          handlePreviousPageRef.current();
          break;
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          handleNextPageRef.current();
          break;
        case 'Home':
          e.preventDefault();
          handleManualPageNavigationRef.current(1);
          break;
        case 'End':
          e.preventDefault();
          handleManualPageNavigationRef.current(totalPagesRef.current);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
    // Intencionalmente sem dependências: os callbacks são sempre lidos via refs
    // sincronizadas para evitar re-attach dos listeners durante navegação.
  }, []);

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
    pageDimensionsUpdateQueueRef.current.set(pageNumber, {
      width: baseWidth,
      height: baseHeight,
      internalRotation: internalRotation || 0
    });

    if (pageDimensionsBatchFrameRef.current === null) {
      pageDimensionsBatchFrameRef.current = window.requestAnimationFrame(flushPageDimensionUpdates);
    }

    if (!firstPaintRecordedRef.current) {
      firstPaintRecordedRef.current = true;
      finishPhaseTimer('critical-first-page', 'FloatingPDFViewer.onPageLoadSuccess', { pageNumber });
    }

    const ownerDocument = getDocumentByGlobalPage(pageNumber);
    if (ownerDocument) {
      const criticalStart = criticalDocStartTimesRef.current.get(ownerDocument.id);
      if (criticalStart !== undefined) {
        const criticalDuration = performance.now() - criticalStart;
        logger.info(
          `Primeira página renderizada para ${ownerDocument.displayName || ownerDocument.fileName} em ${criticalDuration.toFixed(2)}ms`,
          'FloatingPDFViewer.onPageLoadSuccess',
          { documentId: ownerDocument.id, pageNumber, criticalDuration }
        );
        criticalDocStartTimesRef.current.delete(ownerDocument.id);
      }
    }

  }, [state.zoom, finishPhaseTimer, getDocumentByGlobalPage, flushPageDimensionUpdates]);

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
      const isInIdlePages = idlePages.has(state.currentPage);
      const isInVisitedPages = visitedPages.has(state.currentPage);
      const isInScrollBased = scrollBasedVisiblePages.has(state.currentPage);

      if (!isInIdlePages && !isInVisitedPages && !isInScrollBased) {
        setForceRenderPages(prev => {
          const newSet = new Set(prev);
          newSet.add(state.currentPage);
          if (newSet.size > CONTINUOUS_RENDER_BUDGET_PAGES) {
            for (const page of newSet) {
              if (page !== state.currentPage) {
                newSet.delete(page);
                if (newSet.size <= CONTINUOUS_RENDER_BUDGET_PAGES) break;
              }
            }
          }
          return newSet;
        });
      }
    }, 500);

    return () => {
      if (renderFallbackTimeoutRef.current) {
        clearTimeout(renderFallbackTimeoutRef.current);
      }
    };
  }, [state.currentPage, state.viewMode, idlePages, visitedPages, scrollBasedVisiblePages]);

  /**
   * Effect para scroll instantâneo até página quando highlightedPage muda (navegação manual explícita)
   * CORREÇÃO DE BUG: Usa highlightedPage como trigger e marca scroll como programático
   * Também sincroniza lastDetectedPageRef para evitar que detecção de scroll reverta a página
   */
  useEffect(() => {
    if (state.viewMode !== 'continuous' || !state.highlightedPage) return;

    const source = state.isSearchOpen ? 'search' : 'highlight';
    startProgrammaticPageNavigation(state.highlightedPage, source, true);
  }, [state.highlightedPage, state.isSearchOpen, state.viewMode, startProgrammaticPageNavigation]);

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

    markProgrammaticScroll('state-change');
    const targetPage = state.rotationTargetPage;

    setTimeout(() => {
      const pageElement = pageRefs.current.get(targetPage);
      if (pageElement && scrollContainerRef.current) {
        pageElement.scrollIntoView({ behavior: 'instant', block: 'center' });
      }

      setTimeout(() => {
        releaseProgrammaticScroll('state-change');
      }, 400);
    }, 50);
  }, [markProgrammaticScroll, releaseProgrammaticScroll, state.isRotating, state.rotationTargetPage, state.viewMode]);

  const scrollRatioBeforeZoomRef = useRef<number>(0);

  const captureZoomAnchor = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      zoomAnchorRef.current = null;
      return;
    }

    calculateVisiblePagesFromScrollRef.current({ allowLargeJump: true });

    const visibleRange = deriveVisibleRangeFromContainer();
    const fallbackRange = {
      start: visibleStartPageRef.current,
      end: visibleEndPageRef.current
    };
    const range = visibleRange ?? fallbackRange;
    const anchorPage = Math.min(
      state.totalPages,
      Math.max(1, Math.round((range.start + range.end) / 2))
    );

    const anchorPageElement = pageRefs.current.get(anchorPage);
    if (!anchorPageElement || anchorPageElement.offsetHeight <= 0) {
      zoomAnchorRef.current = {
        page: anchorPage,
        relativeOffsetY: 0.5,
        hasMeasuredPage: false
      };
      return;
    }

    const viewportCenterY = container.scrollTop + container.clientHeight / 2;
    const offsetInsidePage = viewportCenterY - anchorPageElement.offsetTop;
    const relativeOffsetY = Math.min(1, Math.max(0, offsetInsidePage / anchorPageElement.offsetHeight));

    zoomAnchorRef.current = {
      page: anchorPage,
      relativeOffsetY,
      hasMeasuredPage: true
    };
  }, [deriveVisibleRangeFromContainer, state.totalPages]);

  useEffect(() => {
    if (state.viewMode !== 'continuous' || !scrollContainerRef.current) {
      prevZoomRef.current = state.zoom;
      return;
    }

    if (prevZoomRef.current === state.zoom) return;

    const scrollRatio = scrollRatioBeforeZoomRef.current;
    const zoomAnchor = zoomAnchorRef.current;

    markProgrammaticScroll('state-change');
    lastZoomTimestampRef.current = Date.now();
    zoomBlockedUntilRef.current = 0;

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) {
        releaseProgrammaticScroll('state-change');
        return;
      }

      const activeContainer = scrollContainerRef.current;
      const anchorPage = zoomAnchor?.page ?? currentPageRef.current;
      const pageAnchorEl = pageRefs.current.get(anchorPage);

      const canUseAnchorPage = Boolean(zoomAnchor?.hasMeasuredPage && pageAnchorEl && pageAnchorEl.offsetHeight > 0);

      if (canUseAnchorPage && zoomAnchor && pageAnchorEl) {
        const anchorOffsetPx = zoomAnchor.relativeOffsetY * pageAnchorEl.offsetHeight;
        const targetCenterY = pageAnchorEl.offsetTop + anchorOffsetPx;
        const nextScrollTop = targetCenterY - activeContainer.clientHeight / 2;
        const maxScrollTop = Math.max(0, activeContainer.scrollHeight - activeContainer.clientHeight);
        activeContainer.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
      } else if (pageAnchorEl && pageAnchorEl.offsetHeight > 0) {
        const relativeOffset = zoomAnchor?.relativeOffsetY ?? 0.5;
        const anchorOffsetPx = relativeOffset * pageAnchorEl.offsetHeight;
        const targetCenterY = pageAnchorEl.offsetTop + anchorOffsetPx;
        const nextScrollTop = targetCenterY - activeContainer.clientHeight / 2;
        const maxScrollTop = Math.max(0, activeContainer.scrollHeight - activeContainer.clientHeight);
        activeContainer.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
      } else {
        const estimatedTop = cumulativePageTops[anchorPage - 1] ?? 0;
        const estimatedHeight = getPageHeight(anchorPage);
        const relativeOffset = zoomAnchor?.relativeOffsetY ?? 0.5;
        const targetCenterY = estimatedTop + relativeOffset * estimatedHeight;
        const nextScrollTop = targetCenterY - activeContainer.clientHeight / 2;
        const maxScrollTop = Math.max(0, activeContainer.scrollHeight - activeContainer.clientHeight);
        activeContainer.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
      }

      const scrollWidth = activeContainer.scrollWidth;
      const clientWidth = activeContainer.clientWidth;
      const centerPosition = (scrollWidth - clientWidth) / 2;
      if (centerPosition > 0) {
        activeContainer.scrollLeft = centerPosition;
      }

      calculateVisiblePagesFromScrollRef.current({ allowLargeJump: true });

      const hasVisibleRangeSnapshot = visibleStartPageRef.current > 0 && visibleEndPageRef.current > 0;
      const detectedFromVisibleRange = hasVisibleRangeSnapshot
        ? Math.min(
            state.totalPages,
            Math.max(1, Math.round((visibleStartPageRef.current + visibleEndPageRef.current) / 2))
          )
        : null;
      const derivedRange = deriveVisibleRangeFromContainer();
      const targetPageSnapshot = zoomAnchor?.page ?? currentPageRef.current;
      const derivedPageAfterZoom = derivedRange
        ? Math.min(
            state.totalPages,
            Math.max(1, Math.round((derivedRange.start + derivedRange.end) / 2))
          )
        : null;
      const targetPageDetected = derivedPageAfterZoom ?? detectedFromVisibleRange ?? targetPageSnapshot;
      const currentPageBeforeSync = state.currentPage;

      logger.info(
        'DEBUG TEMP sincronização de página após zoom',
        'FloatingPDFViewer.zoomSync',
        {
          targetPageSnapshot,
          derivedPageAfterZoom,
          currentPageBeforeSync
        }
      );

      const pageDivergence = Math.abs(targetPageDetected - currentPageBeforeSync);
      if (pageDivergence <= ZOOM_POST_BLOCK_SMALL_DIVERGENCE_PAGES) {
        zoomBlockedUntilRef.current = Date.now() + ZOOM_POST_BLOCK_DURATION_MS;
      }

      lastDetectedPageRef.current = targetPageDetected;
      lastDetectionTimeRef.current = Date.now();
      if (targetPageDetected !== currentPageBeforeSync) {
        goToPage(targetPageDetected);
      }

      const reconciliationStartedAt = Date.now();
      const releaseProgrammaticScrollAfterZoom = () => {
        releaseProgrammaticScroll('zoom-reconciliation');
      };

      const reconcilePageAndRelease = () => {
        calculateVisiblePagesFromScrollRef.current({ allowLargeJump: true });

        const reconciledPage = Math.min(
          state.totalPages,
          Math.max(1, Math.round((visibleStartPageRef.current + visibleEndPageRef.current) / 2))
        );

        if (reconciledPage !== currentPageRef.current) {
          goToPage(reconciledPage);
        }

        const hasConverged = reconciledPage === currentPageRef.current;
        const timedOut = Date.now() - reconciliationStartedAt >= ZOOM_POST_RECONCILIATION_TIMEOUT_MS;

        if (hasConverged || timedOut) {
          releaseProgrammaticScrollAfterZoom();
          return;
        }

        requestAnimationFrame(reconcilePageAndRelease);
      };

      requestAnimationFrame(reconcilePageAndRelease);
    });

    prevZoomRef.current = state.zoom;
    zoomAnchorRef.current = null;
  }, [deriveVisibleRangeFromContainer, goToPage, markProgrammaticScroll, releaseProgrammaticScroll, state.currentPage, state.totalPages, state.viewMode, state.zoom]);

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
        const scrollableHeight = Math.max(0, scrollHeight - scrollContainerRef.current.clientHeight);
        scrollRatioBeforeZoomRef.current = scrollableHeight > 0
          ? scrollContainerRef.current.scrollTop / scrollableHeight
          : 0;
      }
    }
    captureZoomAnchor();
    zoomIn();
  }, [captureZoomAnchor, zoomIn]);

  const captureScrollRatioAndZoomOut = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      if (scrollHeight > 0) {
        const scrollableHeight = Math.max(0, scrollHeight - scrollContainerRef.current.clientHeight);
        scrollRatioBeforeZoomRef.current = scrollableHeight > 0
          ? scrollContainerRef.current.scrollTop / scrollableHeight
          : 0;
      }
    }
    captureZoomAnchor();
    zoomOut();
  }, [captureZoomAnchor, zoomOut]);

  const captureScrollRatioAndResetZoom = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      if (scrollHeight > 0) {
        const scrollableHeight = Math.max(0, scrollHeight - scrollContainerRef.current.clientHeight);
        scrollRatioBeforeZoomRef.current = scrollableHeight > 0
          ? scrollContainerRef.current.scrollTop / scrollableHeight
          : 0;
      }
    }
    captureZoomAnchor();
    resetZoom();
  }, [captureZoomAnchor, resetZoom]);

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
                  {`${topLevelBookmarkCount}/${totalBookmarkCount}`}
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
              ref={handleScrollContainerRef}
              className="absolute inset-0 overflow-auto bg-gray-200"
              style={{ visibility: isModeTransitioning ? 'hidden' : 'visible' }}
            >
              <div className="flex justify-center py-4">
                <div className="flex flex-col items-center space-y-4">
              {state.documents.map((doc, docIndex) => {
                const offset = memoizedDocumentOffsets.get(doc.id);
                const shouldMountDocument = state.viewMode === 'paginated'
                  ? (currentPageInfo ? currentPageInfo.document.id === doc.id : docIndex === 0)
                  : (documentsToMountInContinuous.size === 0
                    ? docIndex === 0
                    : documentsToMountInContinuous.has(docIndex));

                if (state.viewMode === 'paginated') {
                  if (!shouldMountDocument) {
                    return null;
                  }
                }

                if (state.viewMode === 'continuous' && !shouldMountDocument) {
                  const hasDocumentLoaded = loadedDocumentRefsByGenerationRef.current.has(doc.id);

                  return (
                    <div key={doc.id} className="flex flex-col items-center w-full">
                      {docIndex > 0 && (
                        <div className="max-w-4xl mb-4 bg-white border-l-4 border-blue-400 rounded shadow-sm p-2.5">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="text-xs font-semibold text-gray-700 truncate">
                              {doc.displayName}
                            </div>
                          </div>
                        </div>
                      )}
                      <div
                        className={`w-full max-w-4xl rounded-sm flex items-center justify-center ${
                          hasDocumentLoaded
                            ? 'bg-white shadow-lg border border-gray-200'
                            : 'bg-transparent shadow-none border-0'
                        }`}
                        style={{ height: `${estimatedDocumentHeights.get(doc.id) || 920}px` }}
                      >
                        {hasDocumentLoaded && (
                          <div className="text-gray-400 text-xs">
                            Documento fora da janela ativa ({doc.displayName})
                          </div>
                        )}
                      </div>
                    </div>
                  );
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
                      options={PDF_DOCUMENT_OPTIONS}
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
                          const localPageNum = currentPageInfo ? currentPageInfo.localPage : state.currentPage;

                          if (currentPageInfo && currentPageInfo.document.id !== doc.id) {
                            return null;
                          }
                          if (!currentPageInfo && docIndex !== 0) {
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
                                pageNumber={localPageNum}
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
                                localPageNumber={localPageNum}
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
                          const pageArray = pageArraysByDocument.get(doc.id);
                          const pageWindow = continuousWindowByDocument.get(doc.id);
                          if (!pageArray || !offset) {
                            return null;
                          }

                          if (!pageWindow) {
                            return null;
                          }

                          const { rangeStart, rangeEnd } = pageWindow;
                          const rangePages: number[] = [];

                          for (let localPageNum = rangeStart; localPageNum <= rangeEnd; localPageNum++) {
                            rangePages.push(localPageNum);
                          }

                          const sumPageHeights = (startLocalPage: number, endLocalPage: number) => {
                            if (startLocalPage > endLocalPage) {
                              return 0;
                            }

                            let totalHeight = 0;
                            for (let localPageNum = startLocalPage; localPageNum <= endLocalPage; localPageNum++) {
                              const globalPageNum = offset.startPage + localPageNum - 1;
                              totalHeight += getPageHeight(globalPageNum);
                            }
                            return totalHeight;
                          };

                          const beforeCount = Math.max(rangeStart - 1, 0);
                          const afterCount = Math.max(pageArray.length - rangeEnd, 0);
                          const beforeSpacerHeight = beforeCount > 0
                            ? sumPageHeights(1, rangeStart - 1) + (beforeCount * CONTINUOUS_PAGE_GAP_PX)
                            : 0;
                          const afterSpacerHeight = afterCount > 0
                            ? sumPageHeights(rangeEnd + 1, pageArray.length) + (afterCount * CONTINUOUS_PAGE_GAP_PX)
                            : 0;

                          return (
                            <div className="flex flex-col items-center w-full">
                              {beforeSpacerHeight > 0 && (
                                <div
                                  className="w-full"
                                  style={{ height: `${beforeSpacerHeight}px` }}
                                  aria-hidden="true"
                                />
                              )}

                              {rangePages.map((localPageNum) => {
                                const globalPageNum = offset.startPage + localPageNum - 1;
                                const shouldRenderCanvas = continuousCanvasPagesByDocument.get(doc.id)?.has(localPageNum) || false;

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
                                    style={{ marginBottom: localPageNum < rangeEnd ? `${CONTINUOUS_PAGE_GAP_PX}px` : '0px' }}
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
                                      <div
                                        className="bg-white shadow-lg flex items-center justify-center border border-gray-200"
                                        style={{ height: `${pageHeight}px`, width: `${pageWidth}px`, contentVisibility: 'auto', containIntrinsicSize: `${pageWidth}px ${pageHeight}px` }}
                                      >
                                        <div className="text-gray-300 text-xs">
                                          Página {globalPageNum}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {afterSpacerHeight > 0 && (
                                <div
                                  className="w-full"
                                  style={{ height: `${afterSpacerHeight}px` }}
                                  aria-hidden="true"
                                />
                              )}
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
      {state.documents.length > 0 && (
        <PageExtractionModal
          isOpen={state.isPageExtractionModalOpen}
          onClose={closePageExtractionModal}
          documentName={extractionTarget?.document.displayName || extractionTarget?.document.fileName || 'documento.pdf'}
          totalPages={state.totalPages}
          sourceDocuments={extractionSourceDocuments}
        />
      )}
    </>
  );
};

export default React.memo(FloatingPDFViewer);
