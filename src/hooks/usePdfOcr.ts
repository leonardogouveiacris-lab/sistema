import { useState, useCallback, useRef } from 'react';
import { pdfjs } from 'react-pdf';
import {
  getDocumentOcrStatus,
  getPageTextDensity,
  saveOcrResults,
  detectLowTextPages,
  type OcrDocumentStatus,
} from '../services/pdfOcr.service';
import type { OcrEngineProgress } from '../utils/pdfOcrEngine';
import logger from '../utils/logger';

export interface OcrState {
  isRunning: boolean;
  progress: OcrEngineProgress | null;
  status: 'idle' | 'detecting' | 'running' | 'saving' | 'done' | 'error';
  error: string | null;
  lowTextPages: number[];
  documentStatus: OcrDocumentStatus | null;
}

const initialState: OcrState = {
  isRunning: false,
  progress: null,
  status: 'idle',
  error: null,
  lowTextPages: [],
  documentStatus: null,
};

export function usePdfOcr(documentId: string | null) {
  const [state, setState] = useState<OcrState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkStatus = useCallback(async (totalPages?: number) => {
    if (!documentId) return;

    setState(prev => ({ ...prev, status: 'detecting' }));

    try {
      const docStatus = await getDocumentOcrStatus(documentId);

      let lowTextPages: number[] = [];
      if (totalPages && totalPages > 0) {
        const densityMap = await getPageTextDensity(documentId, totalPages);
        lowTextPages = detectLowTextPages(densityMap);
      }

      setState(prev => ({
        ...prev,
        status: 'idle',
        documentStatus: docStatus,
        lowTextPages,
      }));
    } catch (error) {
      logger.error('Failed to check OCR status', 'usePdfOcr.checkStatus', { documentId }, error);
      setState(prev => ({ ...prev, status: 'idle' }));
    }
  }, [documentId]);

  const runOcr = useCallback(async (
    pdfDocument: pdfjs.PDFDocumentProxy,
    pageNumbers?: number[]
  ) => {
    if (!documentId || state.isRunning) return;

    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    setState(prev => ({
      ...prev,
      isRunning: true,
      status: 'running',
      progress: null,
      error: null,
    }));

    try {
      const pagesToProcess = pageNumbers ?? state.lowTextPages;

      if (pagesToProcess.length === 0) {
        const allPages = Array.from({ length: pdfDocument.numPages }, (_, i) => i + 1);
        pagesToProcess.push(...allPages);
      }

      logger.info(
        `Starting OCR for ${pagesToProcess.length} pages`,
        'usePdfOcr.runOcr',
        { documentId, pages: pagesToProcess }
      );

      const { runOcrOnPages } = await import('../utils/pdfOcrEngine');

      const results = await runOcrOnPages(
        pdfDocument,
        pagesToProcess,
        (progress) => {
          setState(prev => ({ ...prev, progress }));
        },
        abortSignal
      );

      if (abortSignal.aborted) {
        setState(prev => ({
          ...prev,
          isRunning: false,
          status: 'idle',
          progress: null,
        }));
        return;
      }

      setState(prev => ({ ...prev, status: 'saving' }));

      const validResults = results.filter(r => r.text.length > 0);
      if (validResults.length > 0) {
        await saveOcrResults(documentId, validResults);
      }

      const updatedStatus = await getDocumentOcrStatus(documentId);

      setState(prev => ({
        ...prev,
        isRunning: false,
        status: 'done',
        progress: null,
        documentStatus: updatedStatus,
      }));

      logger.info(
        `OCR complete: ${validResults.length} pages with text`,
        'usePdfOcr.runOcr',
        { documentId }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('OCR failed', 'usePdfOcr.runOcr', { documentId }, error);
      setState(prev => ({
        ...prev,
        isRunning: false,
        status: 'error',
        progress: null,
        error: message,
      }));
    }
  }, [documentId, state.isRunning, state.lowTextPages]);

  const cancelOcr = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(prev => ({
      ...prev,
      isRunning: false,
      status: 'idle',
      progress: null,
    }));
  }, []);

  const resetOcr = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(initialState);
  }, []);

  return {
    ocrState: state,
    checkOcrStatus: checkStatus,
    runOcr,
    cancelOcr,
    resetOcr,
  };
}
