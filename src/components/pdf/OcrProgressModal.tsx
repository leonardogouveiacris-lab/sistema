import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ScanLine, AlertCircle, CheckCircle, Loader2, FileText, Wand2, Trash2 } from 'lucide-react';
import type { OcrState } from '../../hooks/usePdfOcr';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' };
const THUMBNAIL_SCALE = 0.18;
const PERFORMANCE_PAGE_THRESHOLD = 40;
const INITIAL_THUMBNAIL_BATCH_SIZE = 20;
const THUMBNAIL_APPEND_BATCH_SIZE = 20;
const SCROLL_LOAD_THRESHOLD_PX = 180;

interface OcrProgressModalProps {
  isOpen: boolean;
  ocrState: OcrState;
  totalPages: number;
  pdfUrl: string;
  documentName: string;
  currentPage: number;
  onStart: (pages: number[]) => void;
  onCancel: () => void;
  onClose: () => void;
}

function parsePageInput(input: string, totalPages: number): { pages: number[]; error: string | null } {
  const pages = new Set<number>();
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) return { pages: [], error: null };

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 1 || n > totalPages) {
        return { pages: [], error: `Pagina ${n} fora do intervalo (1-${totalPages}).` };
      }
      pages.add(n);
    } else if (/^\d+-\d+$/.test(part)) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (start > end) {
        return { pages: [], error: `Intervalo invalido: ${part}. O inicio deve ser menor que o fim.` };
      }
      if (start < 1 || end > totalPages) {
        return { pages: [], error: `Intervalo ${part} fora dos limites (1-${totalPages}).` };
      }
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      return { pages: [], error: `Formato invalido: "${part}". Use numeros ou intervalos como "1-5".` };
    }
  }

  return { pages: Array.from(pages).sort((a, b) => a - b), error: null };
}

function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
      rangeStart = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
  return ranges.join(', ');
}

const statusLabel: Record<OcrState['status'], string> = {
  idle: 'Pronto',
  detecting: 'Detectando paginas...',
  running: 'Executando OCR...',
  saving: 'Salvando resultados...',
  done: 'OCR concluido com sucesso',
  error: 'Erro no OCR',
};

const OcrProgressModal: React.FC<OcrProgressModalProps> = ({
  isOpen,
  ocrState,
  totalPages,
  pdfUrl,
  documentName,
  currentPage,
  onStart,
  onCancel,
  onClose,
}) => {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [thumbnailsToRender, setThumbnailsToRender] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const { status, progress, lowTextPages, documentStatus, error, isRunning } = ocrState;
  const isDone = status === 'done';
  const isError = status === 'error';
  const canStart = !isRunning && !isDone;

  const sortedSelectedPages = useMemo(() =>
    Array.from(selectedPages).sort((a, b) => a - b),
  [selectedPages]);

  const shouldUseIncrementalLoading = sortedSelectedPages.length > PERFORMANCE_PAGE_THRESHOLD;

  useEffect(() => {
    if (isOpen && canStart) {
      const initPage = Math.max(1, Math.min(currentPage, totalPages || 1));
      if (lowTextPages.length > 0) {
        setSelectedPages(new Set(lowTextPages));
        setRangeInput(formatPageRanges(lowTextPages));
      } else if (totalPages > 0) {
        setSelectedPages(new Set([initPage]));
        setRangeInput(String(initPage));
      } else {
        setSelectedPages(new Set());
        setRangeInput('');
      }
      setRangeError(null);
      setThumbnailsToRender(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, lowTextPages, currentPage, totalPages, canStart]);

  useEffect(() => {
    if (shouldUseIncrementalLoading) {
      setThumbnailsToRender(Math.min(INITIAL_THUMBNAIL_BATCH_SIZE, sortedSelectedPages.length));
    } else {
      setThumbnailsToRender(sortedSelectedPages.length);
    }
  }, [shouldUseIncrementalLoading, sortedSelectedPages.length]);

  const handleRangeChange = useCallback((input: string) => {
    setRangeInput(input);
    if (!input.trim()) {
      setSelectedPages(new Set());
      setRangeError(null);
      return;
    }
    const result = parsePageInput(input, totalPages);
    if (result.error) {
      setRangeError(result.error);
    } else {
      setSelectedPages(new Set(result.pages));
      setRangeError(null);
    }
  }, [totalPages]);

  const handleSelectDetected = useCallback(() => {
    if (lowTextPages.length > 0) {
      setSelectedPages(new Set(lowTextPages));
      setRangeInput(formatPageRanges(lowTextPages));
    } else {
      setSelectedPages(new Set());
      setRangeInput('');
    }
    setRangeError(null);
  }, [lowTextPages]);

  const handleSelectAll = useCallback(() => {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    setSelectedPages(new Set(all));
    setRangeInput(totalPages > 0 ? `1-${totalPages}` : '');
    setRangeError(null);
  }, [totalPages]);

  const handleSelectCurrent = useCallback(() => {
    const p = Math.max(1, Math.min(currentPage, totalPages || 1));
    setSelectedPages(new Set([p]));
    setRangeInput(String(p));
    setRangeError(null);
  }, [currentPage, totalPages]);

  const handleClear = useCallback(() => {
    setSelectedPages(new Set());
    setRangeInput('');
    setRangeError(null);
  }, []);

  const handleRemovePage = useCallback((page: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      next.delete(page);
      const arr = Array.from(next).sort((a, b) => a - b);
      setRangeInput(formatPageRanges(arr));
      return next;
    });
    setRangeError(null);
  }, []);

  const handleStart = useCallback(() => {
    if (selectedPages.size === 0) return;
    onStart(sortedSelectedPages);
  }, [selectedPages, sortedSelectedPages, onStart]);

  const handleClose = useCallback(() => {
    if (!isRunning) {
      setSelectedPages(new Set());
      setRangeInput('');
      setRangeError(null);
    }
    onClose();
  }, [isRunning, onClose]);

  const handlePreviewScroll = useCallback(() => {
    if (!shouldUseIncrementalLoading) return;
    const container = previewContainerRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD_PX) {
      setThumbnailsToRender(cur =>
        cur >= sortedSelectedPages.length ? cur : Math.min(cur + THUMBNAIL_APPEND_BATCH_SIZE, sortedSelectedPages.length)
      );
    }
  }, [shouldUseIncrementalLoading, sortedSelectedPages.length]);

  const handlePreviewWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const container = previewContainerRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    const canScroll = scrollHeight > clientHeight;
    if (!canScroll) { e.preventDefault(); e.stopPropagation(); return; }
    const atTop = scrollTop <= 0;
    const atBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;
    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); return; }
    e.stopPropagation();
  }, []);

  const progressPercent = progress && progress.totalPages > 0
    ? Math.round((progress.currentPage / progress.totalPages) * 100)
    : 0;

  const progressLabel = progress?.status === 'rendering'
    ? 'Renderizando'
    : progress?.status === 'recognizing'
    ? 'Reconhecendo texto'
    : 'Salvando';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isRunning) handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isRunning, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isRunning ? handleClose : undefined}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <ScanLine className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">OCR — Reconhecimento de Texto</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">{documentName || 'Documento'}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isRunning}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Toolbar */}
          {canStart && (
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[250px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Paginas para OCR (ex: 1-5, 8, 10-12)
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={rangeInput}
                    onChange={e => handleRangeChange(e.target.value)}
                    placeholder="Digite os numeros das paginas..."
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:ring-2 transition-shadow outline-none ${
                      rangeError
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {rangeError && (
                    <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-600">
                      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                      <span>{rangeError}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleSelectCurrent}
                    disabled={totalPages <= 0}
                    className="px-3 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Pagina {Math.max(1, Math.min(currentPage, totalPages || 1))}
                  </button>
                  {lowTextPages.length > 0 && (
                    <button
                      onClick={handleSelectDetected}
                      className="flex items-center gap-1 px-3 py-2.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
                    >
                      <Wand2 size={12} />
                      Detectadas ({lowTextPages.length})
                    </button>
                  )}
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    Todas ({totalPages})
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={selectedPages.size === 0}
                    className="px-3 py-2.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-blue-600">{selectedPages.size}</span>
                    {' '}de {totalPages} paginas selecionadas
                  </span>
                  {documentStatus?.hasOcrContent && (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <CheckCircle size={11} />
                      Possui OCR
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  Total do documento: {totalPages} paginas
                </span>
              </div>
            </div>
          )}

          {/* Preview grid */}
          {canStart && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-[240px]">
              <div className="px-6 py-3 border-b border-gray-100 bg-white">
                <span className="text-sm font-medium text-gray-700">
                  Preview das paginas selecionadas
                </span>
              </div>

              <div
                ref={previewContainerRef}
                onWheel={handlePreviewWheel}
                onScroll={handlePreviewScroll}
                className="flex-1 overflow-y-auto p-4 bg-gray-100/50"
              >
                {sortedSelectedPages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium mb-1">Nenhuma pagina selecionada</p>
                    <p className="text-sm text-gray-400 max-w-xs">
                      Digite os numeros das paginas no campo acima ou use os botoes de selecao rapida
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center content-start">
                    {sortedSelectedPages.map((pageNum, index) => {
                      const shouldRender = index < thumbnailsToRender;
                      return (
                        <div
                          key={pageNum}
                          className="relative group flex flex-col items-center"
                        >
                          <div className="relative bg-white rounded-lg shadow-md overflow-hidden ring-2 ring-blue-500 ring-offset-2">
                            {shouldRender && pdfUrl ? (
                              <Document
                                file={pdfUrl}
                                options={PDF_DOCUMENT_OPTIONS}
                                loading={
                                  <div className="w-[90px] aspect-[3/4] bg-gray-200 animate-pulse flex items-center justify-center">
                                    <span className="text-gray-400 text-xs">{pageNum}</span>
                                  </div>
                                }
                                error={
                                  <div className="w-[90px] aspect-[3/4] bg-red-50 text-red-500 text-[10px] flex items-center justify-center p-1 text-center">
                                    Erro
                                  </div>
                                }
                              >
                                <Page
                                  pageNumber={pageNum}
                                  scale={THUMBNAIL_SCALE}
                                  renderTextLayer={false}
                                  renderAnnotationLayer={false}
                                  loading={
                                    <div className="w-[90px] aspect-[3/4] bg-gray-200 animate-pulse flex items-center justify-center">
                                      <span className="text-gray-400 text-xs">{pageNum}</span>
                                    </div>
                                  }
                                  className="block"
                                />
                              </Document>
                            ) : (
                              <div className="w-[90px] aspect-[3/4] bg-gray-200 animate-pulse flex items-center justify-center">
                                <span className="text-gray-400 text-xs">{pageNum}</span>
                              </div>
                            )}

                            <button
                              onClick={() => handleRemovePage(pageNum)}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              title="Remover pagina"
                            >
                              <Trash2 className="w-3 h-3 text-white" />
                            </button>
                          </div>

                          <span className="mt-2 text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            {pageNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Running / done state */}
          {(isRunning || isDone || isError) && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 space-y-4">
              {isRunning && (
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              )}
              {isDone && (
                <CheckCircle className="w-10 h-10 text-green-500" />
              )}
              {isError && (
                <AlertCircle className="w-10 h-10 text-red-500" />
              )}
              <p className={`text-base font-medium ${isError ? 'text-red-700' : isDone ? 'text-green-700' : 'text-gray-700'}`}>
                {isError ? (error ?? 'Ocorreu um erro') : statusLabel[status]}
              </p>
              {isRunning && progress && (
                <p className="text-sm text-gray-500">
                  {progressLabel} — pagina {progress.currentPage} de {progress.totalPages}
                </p>
              )}
              {isDone && (
                <p className="text-sm text-gray-500 text-center max-w-sm">
                  O texto reconhecido foi salvo e ja esta disponivel na busca do documento.
                </p>
              )}
              <p className="text-xs text-gray-400 text-center max-w-sm mt-2">
                OCR processado localmente via Tesseract.js (pt-BR). O primeiro uso baixa o modelo de lingua (~10 MB).
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700">{progressLabel}</span>
              <span className="text-xs font-medium text-blue-600">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 max-w-xs">
            OCR via Tesseract (pt-BR) — processado localmente no navegador.
          </p>

          <div className="flex gap-3">
            {isRunning ? (
              <button
                onClick={onCancel}
                className="px-4 py-2.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Cancelar
              </button>
            ) : (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {isDone ? 'Fechar' : 'Cancelar'}
                </button>
                {canStart && (
                  <button
                    onClick={handleStart}
                    disabled={selectedPages.size === 0 || !!rangeError}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ScanLine size={15} />
                    Processar {selectedPages.size > 0 ? `(${selectedPages.size})` : ''}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrProgressModal;
