import { useState, useEffect, useCallback, useRef } from 'react';
import { throttle } from '../utils/performance';

export interface ResponsiveBreakpoint {
  name: 'tiny' | 'small' | 'compact' | 'normal' | 'wide';
  minWidth: number;
}

export interface ResponsivePanelConfig {
  breakpoint: ResponsiveBreakpoint['name'];
  panelWidthPercent: number;
  sidebarWidth: number;
  bookmarkPanelWidth: number;
  toolbarCompact: boolean;
  showToolbarLabels: boolean;
  autoHideBookmarkPanel: boolean;
  autoHideSidebar: boolean;
}

const BREAKPOINTS: ResponsiveBreakpoint[] = [
  { name: 'tiny', minWidth: 0 },
  { name: 'small', minWidth: 600 },
  { name: 'compact', minWidth: 900 },
  { name: 'normal', minWidth: 1200 },
  { name: 'wide', minWidth: 1600 }
];

const RESIZE_THROTTLE_MS = 120;

const getBreakpoint = (width: number): ResponsiveBreakpoint['name'] => {
  for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
    if (width >= BREAKPOINTS[i].minWidth) {
      return BREAKPOINTS[i].name;
    }
  }
  return 'tiny';
};

const getConfig = (breakpoint: ResponsiveBreakpoint['name']): ResponsivePanelConfig => {
  switch (breakpoint) {
    case 'tiny':
      return {
        breakpoint,
        panelWidthPercent: 1.0,
        sidebarWidth: 280,
        bookmarkPanelWidth: 200,
        toolbarCompact: true,
        showToolbarLabels: false,
        autoHideBookmarkPanel: true,
        autoHideSidebar: true
      };
    case 'small':
      return {
        breakpoint,
        panelWidthPercent: 1.0,
        sidebarWidth: 280,
        bookmarkPanelWidth: 220,
        toolbarCompact: true,
        showToolbarLabels: false,
        autoHideBookmarkPanel: true,
        autoHideSidebar: false
      };
    case 'compact':
      return {
        breakpoint,
        panelWidthPercent: 1.0,
        sidebarWidth: 300,
        bookmarkPanelWidth: 240,
        toolbarCompact: true,
        showToolbarLabels: false,
        autoHideBookmarkPanel: false,
        autoHideSidebar: false
      };
    case 'normal':
      return {
        breakpoint,
        panelWidthPercent: 0.97,
        sidebarWidth: 360,
        bookmarkPanelWidth: 280,
        toolbarCompact: false,
        showToolbarLabels: true,
        autoHideBookmarkPanel: false,
        autoHideSidebar: false
      };
    case 'wide':
      return {
        breakpoint,
        panelWidthPercent: 0.96,
        sidebarWidth: 400,
        bookmarkPanelWidth: 320,
        toolbarCompact: false,
        showToolbarLabels: true,
        autoHideBookmarkPanel: false,
        autoHideSidebar: false
      };
  }
};


const isSameConfig = (a: ResponsivePanelConfig, b: ResponsivePanelConfig): boolean => {
  return (
    a.breakpoint === b.breakpoint &&
    a.panelWidthPercent === b.panelWidthPercent &&
    a.sidebarWidth === b.sidebarWidth &&
    a.bookmarkPanelWidth === b.bookmarkPanelWidth &&
    a.toolbarCompact === b.toolbarCompact &&
    a.showToolbarLabels === b.showToolbarLabels &&
    a.autoHideBookmarkPanel === b.autoHideBookmarkPanel &&
    a.autoHideSidebar === b.autoHideSidebar
  );
};

/**
 * Frequência: resize limitado para 120ms.
 * Motivo: evitar commits em cascata durante drag de janela mantendo transição de breakpoint fluida.
 */
export const useResponsivePanel = () => {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );
  const [config, setConfig] = useState<ResponsivePanelConfig>(() => {
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    return getConfig(getBreakpoint(initialWidth));
  });

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    setWindowWidth(prev => (prev === width ? prev : width));

    const breakpoint = getBreakpoint(width);
    const nextConfig = getConfig(breakpoint);
    setConfig(prev => (isSameConfig(prev, nextConfig) ? prev : nextConfig));
  }, []);

  const handleResizeRef = useRef(handleResize);
  handleResizeRef.current = handleResize;

  const throttledHandleResizeRef = useRef<ReturnType<typeof throttle> | null>(null);
  if (throttledHandleResizeRef.current === null) {
    throttledHandleResizeRef.current = throttle(
      (...args: Parameters<typeof handleResize>) => handleResizeRef.current(...args),
      RESIZE_THROTTLE_MS
    );
  }

  useEffect(() => {
    handleResize();

    const throttled = throttledHandleResizeRef.current!;
    window.addEventListener('resize', throttled);
    return () => window.removeEventListener('resize', throttled);
  }, [handleResize]);

  const calculatePanelWidth = useCallback((percent?: number): number => {
    const effectivePercent = percent ?? config.panelWidthPercent;
    if (effectivePercent >= 1.0) {
      return windowWidth;
    }
    const desiredWidth = Math.floor(windowWidth * effectivePercent);
    const minWidth = Math.min(800, windowWidth - 50);
    return Math.max(minWidth, Math.min(desiredWidth, windowWidth - 50));
  }, [windowWidth, config.panelWidthPercent]);

  return {
    windowWidth,
    config,
    calculatePanelWidth,
    isTiny: config.breakpoint === 'tiny',
    isSmall: config.breakpoint === 'small',
    isCompact: config.breakpoint === 'compact',
    isNormal: config.breakpoint === 'normal',
    isWide: config.breakpoint === 'wide'
  };
};

export default useResponsivePanel;
