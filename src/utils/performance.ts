import type { PDFBookmark } from '../types/PDFBookmark';

/**
 * Performance utilities for optimizing React components
 *
 * Provides debounce, throttle, and other performance optimization helpers.
 * Limitação: estes utilitários priorizam simplicidade local; evite para cenários
 * de sincronização entre abas/dispositivos ou consistência forte de dados.
 */

type AnyFunction = (...args: unknown[]) => unknown;
type PrimitiveMemoizeKeyPart = string | number | boolean | null | undefined;
export type MemoizeKey = PrimitiveMemoizeKeyPart | readonly PrimitiveMemoizeKeyPart[];

interface BookmarkCacheData {
  bookmarks: PDFBookmark[];
  timestamp: number;
  version: string;
}

function isBookmarkCacheData(value: unknown): value is BookmarkCacheData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BookmarkCacheData>;
  return typeof candidate.timestamp === 'number' && Array.isArray(candidate.bookmarks);
}

/**
 * Debounces a function to prevent excessive calls
 * The function will only be called after the specified delay has passed since the last call
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends AnyFunction>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttles a function to limit how often it can be called
 * The function will be called at most once every `limit` milliseconds
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends AnyFunction>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Creates a memoized version of a function that caches results based on arguments
 * Useful for expensive computations that are called repeatedly with the same arguments
 *
 * Limitação: use para funções puras/determinísticas; evite quando houver dependência
 * de hora, I/O, estado global mutável ou efeitos colaterais.
 * @param fn - Function to memoize
 * @param keyFn - Recomendado para args não-primitivos; sem ele o cache só é seguro para args primitivos
 * @returns Memoized function
 */
export function memoize<T extends AnyFunction>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => MemoizeKey
): T {
  const cache = new Map<string, ReturnType<T>>();

  const normalizeMemoizeKey = (key: MemoizeKey): string =>
    Array.isArray(key) ? key.map(part => String(part)).join('|') : String(key);

  const buildDefaultKey = (args: Parameters<T>): string | null => {
    const hasOnlyPrimitives = args.every(
      arg => arg === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof arg)
    );

    if (!hasOnlyPrimitives) {
      return null;
    }

    try {
      return JSON.stringify(args);
    } catch {
      return null;
    }
  };

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn ? normalizeMemoizeKey(keyFn(...args)) : buildDefaultKey(args);

    if (!key) {
      return fn(...args) as ReturnType<T>;
    }

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Runs a function on the next idle callback (when browser is idle)
 * Falls back to setTimeout if requestIdleCallback is not available
 *
 * @param callback - Function to run when idle
 * @param options - Options for idle callback
 * @returns Cancellation function
 */
export function runWhenIdle(
  callback: () => void,
  options?: { timeout?: number }
): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const handle = requestIdleCallback(callback, options);
    return () => cancelIdleCallback(handle);
  } else {
    const timeoutId = setTimeout(callback, options?.timeout || 1);
    return () => clearTimeout(timeoutId);
  }
}

/**
 * Batches multiple function calls into a single call on the next animation frame
 * Useful for batching DOM updates or state updates
 *
 * @param fn - Function to batch
 * @returns Batched function
 */
export function batchOnAnimationFrame<T extends AnyFunction>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let latestArgs: Parameters<T> | null = null;

  return function batched(...args: Parameters<T>) {
    latestArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (latestArgs !== null) {
          fn(...latestArgs);
          latestArgs = null;
        }
        rafId = null;
      });
    }
  };
}

export function generatePDFCacheKey(url: string, numPages: number, documentId?: string): string {
  if (documentId) {
    return `pdf_bookmarks_${documentId}_${numPages}`;
  }

  const urlParts = url.split('?')[0].split('/');
  const fileName = urlParts.pop() || '';
  return `pdf_bookmarks_${fileName}_${numPages}`;
}

/**
 * Saves bookmarks to localStorage with a cache key
 * Limitação: cache local para aceleração; evite para persistência oficial/sensível.
 *
 * @param cacheKey - Unique cache key for the document
 * @param bookmarks - Bookmarks to cache
 * @returns True if saved successfully, false otherwise
 */
export function saveBookmarksToCache(cacheKey: string, bookmarks: PDFBookmark[]): boolean {
  try {
    const cacheData: BookmarkCacheData = {
      bookmarks,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads bookmarks from localStorage cache
 * Limitação: use apenas como cache best-effort; dados inválidos são descartados silenciosamente.
 *
 * @param cacheKey - Unique cache key for the document
 * @param maxAgeMs - Maximum age of cache in milliseconds (default: 7 days)
 * @returns Cached bookmarks or null if not found/expired
 */
export function loadBookmarksFromCache(
  cacheKey: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): PDFBookmark[] | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const cacheData: unknown = JSON.parse(cached);
    if (!isBookmarkCacheData(cacheData)) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    const age = Date.now() - cacheData.timestamp;

    if (age > maxAgeMs) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return cacheData.bookmarks;
  } catch {
    return null;
  }
}

/**
 * Clears old bookmark caches from localStorage
 * Removes entries older than the specified age
 *
 * @param maxAgeMs - Maximum age of cache in milliseconds (default: 30 days)
 */
export function clearOldBookmarkCaches(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): void {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach(key => {
      if (key.startsWith('pdf_bookmarks_')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const cacheData = JSON.parse(cached);
            const age = now - cacheData.timestamp;
            if (age > maxAgeMs) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Silently ignore errors cleaning cache
  }
}
