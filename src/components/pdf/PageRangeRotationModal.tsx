import React, { useState, useCallback, useMemo } from 'react';
import { X, RotateCw, RotateCcw, RefreshCcw, AlertCircle } from 'lucide-react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';

interface PageRangeRotationModalProps {
  totalPages: number;
}

const PageRangeRotationModal: React.FC<PageRangeRotationModalProps> = ({ totalPages }) => {
  const { state, closeRotationModal, rotatePagesBy } = usePDFViewer();
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const parsePageRanges = useCallback((input: string): number[] => {
    const pages = new Set<number>();
    const parts = input.split(',').map(s => s.trim()).filter(s => s.length > 0);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map(s => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Intervalo invalido: "${part}"`);
        }
        if (start < 1 || end < 1) {
          throw new Error(`Numeros de pagina devem ser maiores que 0`);
        }
        if (start > totalPages || end > totalPages) {
          throw new Error(`Pagina ${Math.max(start, end)} excede o total de ${totalPages}`);
        }
        if (start > end) {
          throw new Error(`Intervalo invertido: "${part}". Use ${end}-${start}`);
        }

        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (isNaN(pageNum)) {
          throw new Error(`Numero invalido: "${part}"`);
        }
        if (pageNum < 1) {
          throw new Error(`Numeros de pagina devem ser maiores que 0`);
        }
        if (pageNum > totalPages) {
          throw new Error(`Pagina ${pageNum} excede o total de ${totalPages}`);
        }
        pages.add(pageNum);
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }, [totalPages]);

  const { parsedPages, isValid } = useMemo(() => {
    if (!inputValue.trim()) {
      return { parsedPages: [], isValid: false };
    }

    try {
      const pages = parsePageRanges(inputValue);
      setValidationError(null);
      return { parsedPages: pages, isValid: pages.length > 0 };
    } catch (error) {
      setValidationError((error as Error).message);
      return { parsedPages: [], isValid: false };
    }
  }, [inputValue, parsePageRanges]);

  const handleRotate = useCallback((degrees: number) => {
    if (!isValid || parsedPages.length === 0) return;
    rotatePagesBy(parsedPages, degrees);
    closeRotationModal();
  }, [isValid, parsedPages, rotatePagesBy, closeRotationModal]);

  const handleQuickSelect = useCallback((type: 'all' | 'odd' | 'even' | 'current') => {
    switch (type) {
      case 'all':
        setInputValue(`1-${totalPages}`);
        break;
      case 'odd':
        const oddPages = [];
        for (let i = 1; i <= totalPages; i += 2) {
          oddPages.push(i);
        }
        setInputValue(oddPages.join(', '));
        break;
      case 'even':
        const evenPages = [];
        for (let i = 2; i <= totalPages; i += 2) {
          evenPages.push(i);
        }
        setInputValue(evenPages.join(', '));
        break;
      case 'current':
        setInputValue(state.currentPage.toString());
        break;
    }
  }, [totalPages, state.currentPage]);

  if (!state.isRotationModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 w-[420px] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Rotacionar Paginas</h3>
          <button
            onClick={closeRotationModal}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Intervalo de paginas (ex: 1-5, 8, 10-12)
          </label>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite as paginas..."
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              validationError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            autoFocus
          />

          {validationError && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-red-600">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {isValid && parsedPages.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              <span className="font-medium text-blue-600">{parsedPages.length}</span> pagina(s) selecionada(s)
              {parsedPages.length <= 10 && (
                <span className="ml-1 text-gray-500">
                  ({parsedPages.join(', ')})
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => handleQuickSelect('current')}
              className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Pagina atual ({state.currentPage})
            </button>
            <button
              onClick={() => handleQuickSelect('all')}
              className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Todas ({totalPages})
            </button>
            <button
              onClick={() => handleQuickSelect('odd')}
              className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Impares
            </button>
            <button
              onClick={() => handleQuickSelect('even')}
              className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Pares
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Escolha a rotacao
            </label>

            <div className="flex gap-1.5">
              <button
                onClick={() => handleRotate(90)}
                disabled={!isValid}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 disabled:cursor-not-allowed rounded transition-colors"
              >
                <RotateCw size={14} />
                <span>90</span>
              </button>

              <button
                onClick={() => handleRotate(-90)}
                disabled={!isValid}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 disabled:cursor-not-allowed rounded transition-colors"
              >
                <RotateCcw size={14} />
                <span>-90</span>
              </button>

              <button
                onClick={() => handleRotate(180)}
                disabled={!isValid}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100 disabled:cursor-not-allowed rounded transition-colors"
              >
                <RefreshCcw size={14} />
                <span>180</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <p className="text-xs text-gray-500">
            Dica: Use virgulas para separar paginas e hifen para intervalos. Ex: 1-5, 8, 10-12
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageRangeRotationModal;
