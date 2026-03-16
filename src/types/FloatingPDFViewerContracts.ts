import type React from 'react';

export interface FloatingPDFDocument {
  id: string;
  fileName?: string;
  displayName?: string;
}

export interface PDFViewerMinimizedButtonProps {
  documents: FloatingPDFDocument[];
  currentPage: number;
  totalPages: number;
  onExpand: () => void;
}

export interface PDFViewerHeaderProps {
  documents: FloatingPDFDocument[];
  currentPage: number;
  totalPages: number;
  zoom: number;
  onMinimize: () => void;
  onClose: () => void;
}

export interface PDFViewerSidebarAreaProps {
  isVisible: boolean;
  width: number;
  processId?: string;
  onResizeStart?: (e: React.MouseEvent) => void;
}

export interface UsePDFPageNavigationParams {
  viewMode: 'continuous' | 'paginated';
  currentPage: number;
  totalPages: number;
  isRotating: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onGoToPage: (page: number) => void;
  onStartProgrammaticNavigation: (page: number, source: 'manual' | 'keyboard' | 'state-change', updateStorePage?: boolean) => void;
  onMarkProgrammaticScroll: (reason: 'state-change' | 'search') => void;
  keyboardNavLockDurationMs: number;
  keyboardNavRefs: {
    targetPageRef: React.MutableRefObject<number | null>;
    recentTargetPageRef: React.MutableRefObject<number | null>;
    lockUntilRef: React.MutableRefObject<number>;
    targetReachedAtRef: React.MutableRefObject<number | null>;
    stableFramesRef: React.MutableRefObject<number>;
  };
}

export interface UsePDFKeyboardShortcutsParams {
  onToggleSearch: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  totalPagesRef: React.MutableRefObject<number>;
  keyboardNavigationThrottleMsRef: React.MutableRefObject<number>;
  keyboardNavRefs: {
    targetPageRef: React.MutableRefObject<number | null>;
    lockUntilRef: React.MutableRefObject<number>;
    cooldownUntilRef: React.MutableRefObject<number>;
    stableFramesRef: React.MutableRefObject<number>;
    pendingNavigationTargetRef: React.MutableRefObject<{ page: number; flowId: string; source: string; startedAt: number } | null>;
    lastInputAtRef: React.MutableRefObject<number>;
  };
  lockDurationMs: number;
  cooldownDurationMs: number;
}

export interface UsePDFTextSelectionEffectsParams {
  selectionMode: 'native-drag' | 'overlay';
  hasSelection: boolean;
  onHandleTextSelection: () => void;
  startedInsidePdfRef: React.MutableRefObject<boolean>;
  scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  textSelectionDebounceRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export interface BookmarkDocumentEntry {
  bookmarks: unknown[];
  documentName: string;
  documentIndex: number;
  pageCount: number;
}

export type BookmarkDocumentMap = Map<string, BookmarkDocumentEntry>;

export interface UsePdfNavigationStateParams {
  logEvent: (event: string, payload: Record<string, unknown>) => void;
  getCurrentPage: () => number;
  currentPageRef: React.MutableRefObject<number>;
}

export interface FloatingViewerNavigationDomain {
  pageInputValue: string;
  onSetPageInputValue: (value: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onManualNavigation: (page: number) => void;
}

export interface FloatingViewerBookmarksDomain {
  documentBookmarks: BookmarkDocumentMap;
  topLevelBookmarkCount: number;
  totalBookmarkCount: number;
  isBookmarkPanelVisible: boolean;
  toggleBookmarkPanel: () => void;
}

export interface FloatingViewerSelectionCommentsDomain {
  showColorPicker: boolean;
  setShowColorPicker: React.Dispatch<React.SetStateAction<boolean>>;
  showCommentColorPicker: boolean;
  setShowCommentColorPicker: React.Dispatch<React.SetStateAction<boolean>>;
  onCreateHighlight: () => void | Promise<void>;
}

export interface FloatingViewerRenderStrategyDomain {
  idlePages: Set<number>;
  visitedPages: Set<number>;
  forceRenderPages: Set<number>;
  scrollRenderCache: Set<number>;
}

export interface FloatingViewerToolbarVisualDomain {
  showToolbarOverflow: boolean;
  setShowToolbarOverflow: React.Dispatch<React.SetStateAction<boolean>>;
  showToolbarLabels: boolean;
  toolbarCompact: boolean;
}
