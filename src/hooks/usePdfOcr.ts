import { useState, useCallback, useRef } from 'react';
import { pdfjs } from 'react-pdf';
import {
  getDocumentOcrStatus,
  saveOcrResults,
  type OcrDocumentStatus,
} from '../services/pdfOcr.service';
import type { OcrEngineProgress, OcrParams } from '../utils/pdfOcrEngine';
import { OCR_PARAMS_DEFAULT } from '../utils/pdfOcrEngine';
import logger from '../utils/logger';

export interface OcrState {
  isRunning: boolean;
  progress: OcrEngineProgress | null;
  status: 'idle' | 'running' | 'saving' | 'done' | 'error';
  error: string | null;
  documentStatus: OcrDocumentStatus | null;
}

const initialState: OcrState = {
  isRunning: false,
  progress: null,
  status: 'idle',
  error: null,
  documentStatus: null,
};

export function usePdfOcr(documentId: string | null) {
  const [state, setState] = useState<OcrState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadStatus = useCallback(async () => {
    if (!documentId) return;
    try {
      const docStatus = await getDocumentOcrStatus(documentId);
      setState(prev => ({ ...prev, documentStatus: docStatus }));
    } catch (error) {
      logger.error('Failed to load OCR status', 'usePdfOcr.loadStatus', { documentId }, error);
    }
  }, [documentId]);

  const runOcr = useCallback(async (
    pdfDocument: pdfjs.PDFDocumentProxy,
    pageNumbers: number[],
    params: OcrParams = OCR_PARAMS_DEFAULT
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
      logger.info(
        `Starting OCR for ${pageNumbers.length} pages`,
        'usePdfOcr.runOcr',
        { documentId, pages: pageNumbers, params }
      );

      const { runOcrOnPages } = await import('../utils/pdfOcrEngine');

      const results = await runOcrOnPages(
        pdfDocument,
        pageNumbers,
        params,
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
  }, [documentId, state.isRunning]);

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
    loadOcrStatus: loadStatus,
    runOcr,
    cancelOcr,
    resetOcr,
  };
}
