/**
 * Performance utilities for optimizing React components
 *
 * Provides debounce, throttle, and other performance optimization helpers
 */

/**
 * Debounces a function to prevent excessive calls
 * The function will only be called after the specified delay has passed since the last call
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
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
export function throttle<T extends (...args: any[]) => any>(
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
 * @param fn - Function to memoize
 * @param keyFn - Optional function to generate cache key from arguments
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

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
export function batchOnAnimationFrame<T extends (...args: any[]) => any>(
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
 *
 * @param cacheKey - Unique cache key for the document
 * @param bookmarks - Bookmarks to cache
 * @returns True if saved successfully, false otherwise
 */
export function saveBookmarksToCache(cacheKey: string, bookmarks: any[]): boolean {
  try {
    const cacheData = {
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
 *
 * @param cacheKey - Unique cache key for the document
 * @param maxAgeMs - Maximum age of cache in milliseconds (default: 7 days)
 * @returns Cached bookmarks or null if not found/expired
 */
export function loadBookmarksFromCache(
  cacheKey: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): any[] | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;

    // Check if cache is still valid
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
          // Invalid cache entry, remove it
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Silently ignore errors cleaning cache
  }
}
