import logger from './logger';
import type { DocumentTextCache, PageTextContent } from './pdfTextExtractor';
import { supabase } from '../lib/supabase';

const DB_NAME = 'pdfTextCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  if (!('indexedDB' in window)) {
    logger.warn('IndexedDB is not available in this environment', 'pdfTextCache.openDB');
    return Promise.resolve(null);
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('Failed to open IndexedDB', 'pdfTextCache.openDB', undefined, request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'documentId' });
      }
    };
  });

  return dbPromise;
}

interface CachedDocumentData {
  documentId: string;
  pages: Array<{ pageNumber: number; content: PageTextContent }>;
  timestamp: number;
}

export async function getCachedDocument(documentId: string): Promise<DocumentTextCache | null> {
  try {
    const db = await openDB();
    if (!db) {
      return null;
    }
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(documentId);

      request.onsuccess = () => {
        const data = request.result as CachedDocumentData | undefined;
        if (!data) {
          resolve(null);
          return;
        }

        const pages = new Map<number, PageTextContent>();
        for (const page of data.pages) {
          pages.set(page.pageNumber, page.content);
        }

        resolve({ documentId: data.documentId, pages });
      };

      request.onerror = () => {
        logger.error(
          'Failed to get cached document',
          'pdfTextCache.getCachedDocument',
          undefined,
          request.error
        );
        resolve(null);
      };
    });
  } catch (err) {
    logger.error('Failed to access IndexedDB cache', 'pdfTextCache.getCachedDocument', undefined, err);
    return null;
  }
}

export async function cacheDocument(cache: DocumentTextCache): Promise<void> {
  try {
    const db = await openDB();
    if (!db) {
      logger.warn('IndexedDB is not available; skipping cache write', 'pdfTextCache.cacheDocument');
      return;
    }
    const pages: Array<{ pageNumber: number; content: PageTextContent }> = [];

    cache.pages.forEach((content, pageNumber) => {
      pages.push({ pageNumber, content });
    });

    const data: CachedDocumentData = {
      documentId: cache.documentId,
      pages,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to cache document', 'pdfTextCache.cacheDocument', undefined, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Failed to cache document', 'pdfTextCache.cacheDocument', undefined, error);
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    if (!db) {
      return;
    }
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      transaction.oncomplete = () => {
        resolve();
      };
    });
  } catch (err) {
    logger.error('Failed to clear cache', 'pdfTextCache.clearCache', undefined, err);
  }
}

export async function persistToDatabase(cache: DocumentTextCache): Promise<boolean> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pdfTextCache.persistToDatabase');
      return false;
    }
    const { data: existing } = await supabase
      .from('pdf_text_pages')
      .select('id')
      .eq('process_document_id', cache.documentId)
      .limit(1);

    if (existing && existing.length > 0) {
      return true;
    }

    const insertData: Array<{
      process_document_id: string;
      page_number: number;
      text_content: string;
    }> = [];

    cache.pages.forEach((content, pageNumber) => {
      insertData.push({
        process_document_id: cache.documentId,
        page_number: pageNumber,
        text_content: content.text
      });
    });

    if (insertData.length === 0) {
      return true;
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
      const batch = insertData.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('pdf_text_pages')
        .insert(batch);

      if (error) {
        logger.error(
          `Failed to persist pages ${i + 1}-${i + batch.length} to database`,
          'pdfTextCache.persistToDatabase',
          undefined,
          error
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Failed to persist to database', 'pdfTextCache.persistToDatabase', undefined, error);
    return false;
  }
}

export async function loadFromDatabase(documentId: string): Promise<DocumentTextCache | null> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pdfTextCache.loadFromDatabase');
      return null;
    }
    const { data, error } = await supabase
      .from('pdf_text_pages')
      .select('page_number, text_content')
      .eq('process_document_id', documentId)
      .order('page_number', { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    const pages = new Map<number, PageTextContent>();
    for (const row of data) {
      pages.set(row.page_number, {
        pageNumber: row.page_number,
        text: row.text_content || '',
        items: []
      });
    }

    return { documentId, pages };
  } catch (error) {
    logger.error('Failed to load from database', 'pdfTextCache.loadFromDatabase', undefined, error);
    return null;
  }
}
