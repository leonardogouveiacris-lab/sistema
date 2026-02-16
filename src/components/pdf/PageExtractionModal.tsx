import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, FileOutput, Check, Loader2, AlertCircle, ChevronLeft, ChevronRight, FileText, Trash2 } from 'lucide-react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useToast } from '../../contexts/ToastContext';
import {
  parsePageRanges,
  formatPageRanges,
  extractPagesFromPDF,
  downloadPDF,
  generateExtractedFilename,
  ExtractionProgress
} from '../../utils/pdfPageExtractor';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PageExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  documentName: string;
  totalPages: number;
}

const THUMBNAIL_SCALE = 0.18;
const THUMBNAILS_PER_ROW = 6;
const THUMBNAIL_BATCH_SIZE = 3;

const PageExtractionModal: React.FC<PageExtractionModalProps> = ({
  isOpen,
  onClose,
  documentUrl,
  documentName,
  totalPages
}) => {
  const { state } = usePDFViewer();
  const toast = useToast();

  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pageRangeInput, setPageRangeInput] = useState('');
  const [outputFilename, setOutputFilename] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewDocumentReady, setIsPreviewDocumentReady] = useState(false);
  const [thumbnailsToRender, setThumbnailsToRender] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedSelectedPages = useMemo(() =>
    Array.from(selectedPages).sort((a, b) => a - b),
    [selectedPages]
  );

  const totalPreviewPages = Math.ceil(sortedSelectedPages.length / THUMBNAILS_PER_ROW);
  const previewStartIndex = previewPage * THUMBNAILS_PER_ROW;
  const previewEndIndex = Math.min(previewStartIndex + THUMBNAILS_PER_ROW, sortedSelectedPages.length);
  const visiblePreviewPages = sortedSelectedPages.slice(previewStartIndex, previewEndIndex);

  useEffect(() => {
    if (isOpen) {
      setSelectedPages(new Set([state.currentPage]));
      setPageRangeInput(String(state.currentPage));
      setOutputFilename(generateExtractedFilename(documentName, [state.currentPage]));
      setError(null);
      setProgress(null);
      setPreviewPage(0);
      setIsPreviewDocumentReady(false);
      setThumbnailsToRender(0);

      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, state.currentPage, documentName]);

  useEffect(() => {
    if (selectedPages.size > 0) {
      const pagesArray = Array.from(selectedPages).sort((a, b) => a - b);
      setOutputFilename(generateExtractedFilename(documentName, pagesArray));
    }
  }, [selectedPages, documentName]);

  useEffect(() => {
    setPreviewPage(0);
  }, [selectedPages.size]);

  const handlePageRangeChange = useCallback((input: string) => {
    setPageRangeInput(input);
    const pages = parsePageRanges(input, totalPages);
    setSelectedPages(new Set(pages));
  }, [totalPages]);

  const handleSelectAll = useCallback(() => {
    const allPages = new Set<number>();
    for (let i = 1; i <= totalPages; i++) {
      allPages.add(i);
    }
    setSelectedPages(allPages);
    setPageRangeInput(`1-${totalPages}`);
  }, [totalPages]);

  const handleSelectCurrentPage = useCallback(() => {
    setSelectedPages(new Set([state.currentPage]));
    setPageRangeInput(String(state.currentPage));
  }, [state.currentPage]);

  const handleClearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setPageRangeInput('');
  }, []);

  const handleRemovePage = useCallback((pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageNum);
      return newSet;
    });
    setPageRangeInput(prev => {
      const currentPages = parsePageRanges(prev, totalPages);
      const filtered = currentPages.filter(p => p !== pageNum);
      return formatPageRanges(filtered);
    });
  }, [totalPages]);

  const handleExtract = useCallback(async () => {
    if (selectedPages.size === 0) {
      setError('Selecione pelo menos uma pagina para extrair');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const pagesToExtract = Array.from(selectedPages).sort((a, b) => a - b);

      const pdfBytes = await extractPagesFromPDF(
        documentUrl,
        pagesToExtract,
        setProgress
      );

      downloadPDF(pdfBytes, outputFilename || 'documento_extraido.pdf');

      toast.success(`${pagesToExtract.length} pagina(s) extraida(s) com sucesso!`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao extrair paginas';
      setError(message);
      toast.error(message);
    } finally {
      setIsExtracting(false);
      setProgress(null);
    }
  }, [selectedPages, documentUrl, outputFilename, toast, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isExtracting) {
      onClose();
    }
  }, [onClose, isExtracting]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isPreviewDocumentReady) {
      setThumbnailsToRender(0);
      return;
    }

    const totalVisiblePages = visiblePreviewPages.length;
    let renderedCount = 0;
    let animationFrameId: number;

    const renderBatch = () => {
      renderedCount = Math.min(renderedCount + THUMBNAIL_BATCH_SIZE, totalVisiblePages);
      setThumbnailsToRender(renderedCount);

      if (renderedCount < totalVisiblePages) {
        animationFrameId = requestAnimationFrame(renderBatch);
      }
    };

    setThumbnailsToRender(0);
    animationFrameId = requestAnimationFrame(renderBatch);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPreviewDocumentReady, visiblePreviewPages]);

  if (!isOpen) return null;

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isExtracting ? onClose : undefined}
      />

      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <FileOutput className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Extrair Paginas</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">{documentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExtracting}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[250px]">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Paginas para extrair (ex: 1-5, 8, 10-12)
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={pageRangeInput}
                  onChange={(e) => handlePageRangeChange(e.target.value)}
                  placeholder="Digite os intervalos de paginas..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  disabled={isExtracting}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSelectCurrentPage}
                  disabled={isExtracting}
                  className="px-3 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Pagina {state.currentPage}
                </button>
                <button
                  onClick={handleSelectAll}
                  disabled={isExtracting}
                  className="px-3 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Todas ({totalPages})
                </button>
                <button
                  onClick={handleClearSelection}
                  disabled={isExtracting || selectedPages.size === 0}
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
              </div>
              <span className="text-xs text-gray-400">
                Total: {totalPages} paginas no documento
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-[280px]">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
              <span className="text-sm font-medium text-gray-700">
                Preview das paginas selecionadas
              </span>
              {sortedSelectedPages.length > THUMBNAILS_PER_ROW && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                    disabled={previewPage === 0 || isExtracting}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-gray-500 min-w-[60px] text-center">
                    {previewPage + 1} / {totalPreviewPages}
                  </span>
                  <button
                    onClick={() => setPreviewPage(p => Math.min(totalPreviewPages - 1, p + 1))}
                    disabled={previewPage >= totalPreviewPages - 1 || isExtracting}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-100/50">
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
                <Document
                  file={documentUrl}
                  loading={null}
                  error={null}
                  onLoadSuccess={() => setIsPreviewDocumentReady(true)}
                  onLoadError={() => setIsPreviewDocumentReady(false)}
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 justify-items-center">
                    {!isPreviewDocumentReady && (
                      <div className="col-span-full flex items-center justify-center py-8 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    )}

                    {visiblePreviewPages.map((pageNum, index) => {
                      const shouldRenderPage = isPreviewDocumentReady && index < thumbnailsToRender;

                      return (
                        <div
                          key={pageNum}
                          className="relative group flex flex-col items-center"
                        >
                          <div className="relative bg-white rounded-lg shadow-md overflow-hidden ring-2 ring-blue-500 ring-offset-2">
                            {shouldRenderPage ? (
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
                            ) : (
                              <div className="w-[90px] aspect-[3/4] bg-gray-200 animate-pulse flex items-center justify-center">
                                <span className="text-gray-400 text-xs">{pageNum}</span>
                              </div>
                            )}

                            <div className="absolute top-1 left-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow">
                              <Check className="w-3 h-3 text-white" />
                            </div>

                            <button
                              onClick={() => handleRemovePage(pageNum)}
                              disabled={isExtracting}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                              title="Remover pagina"
                            >
                              <Trash2 className="w-3 h-3 text-white" />
                            </button>
                          </div>

                          <span className="mt-2 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            Pagina {pageNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Document>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {isExtracting && progress && (
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700">{progress.message}</span>
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

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nome do arquivo
              </label>
              <input
                type="text"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                placeholder="documento_extraido.pdf"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                disabled={isExtracting}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isExtracting}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtract}
                disabled={isExtracting || selectedPages.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extraindo...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Extrair {selectedPages.size > 0 ? `(${selectedPages.size})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageExtractionModal;
