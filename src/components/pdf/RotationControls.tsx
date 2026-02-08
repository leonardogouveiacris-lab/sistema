import React, { useState, useRef, useEffect } from 'react';
import { RotateCw, RotateCcw, ChevronDown, RefreshCcw, ListOrdered } from 'lucide-react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';

interface RotationControlsProps {
  currentPage: number;
  totalPages: number;
}

const RotationControls: React.FC<RotationControlsProps> = ({ currentPage, totalPages }) => {
  const {
    rotatePageBy,
    resetPageRotation,
    resetAllRotations,
    openRotationModal,
    getPageRotation,
    hasRotations,
    rotatedPageCount
  } = usePDFViewer();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentRotation = getPageRotation(currentPage);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (e.shiftKey) {
          rotatePageBy(currentPage, -90);
        } else {
          rotatePageBy(currentPage, 90);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, rotatePageBy]);

  const handleRotate90CW = () => {
    rotatePageBy(currentPage, 90);
  };

  const handleRotate90CCW = () => {
    rotatePageBy(currentPage, -90);
    setIsDropdownOpen(false);
  };

  const handleRotate180 = () => {
    rotatePageBy(currentPage, 180);
    setIsDropdownOpen(false);
  };

  const handleResetCurrentPage = () => {
    resetPageRotation(currentPage);
    setIsDropdownOpen(false);
  };

  const handleResetAll = () => {
    resetAllRotations();
    setIsDropdownOpen(false);
  };

  const handleOpenRangeModal = () => {
    openRotationModal();
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        onClick={handleRotate90CW}
        className="flex items-center px-2 py-1 text-xs font-medium border rounded-l transition-colors duration-200 bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        title="Rotacionar 90 graus (R)"
      >
        <RotateCw size={14} />
      </button>

      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`flex items-center px-1.5 py-1 text-xs font-medium border-t border-b border-r rounded-r transition-colors duration-200 ${
          isDropdownOpen
            ? 'bg-gray-100 text-gray-900 border-gray-400'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Mais opcoes de rotacao"
      >
        <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[200px]">
          <div className="px-3 py-1.5 text-xs text-gray-500 font-medium border-b border-gray-100">
            Pagina {currentPage} {currentRotation !== 0 && `(${currentRotation} graus)`}
          </div>

          <button
            onClick={handleRotate90CCW}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={14} className="mr-2 text-gray-500" />
            <span>Rotacionar 90 anti-horario</span>
            <span className="ml-auto text-xs text-gray-400">Shift+R</span>
          </button>

          <button
            onClick={handleRotate180}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCcw size={14} className="mr-2 text-gray-500" />
            <span>Rotacionar 180 graus</span>
          </button>

          <div className="my-1 border-t border-gray-100" />

          <button
            onClick={handleOpenRangeModal}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ListOrdered size={14} className="mr-2 text-gray-500" />
            <span>Rotacionar intervalo de paginas...</span>
          </button>

          <div className="my-1 border-t border-gray-100" />

          <button
            onClick={handleResetCurrentPage}
            disabled={currentRotation === 0}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCw size={14} className="mr-2 text-gray-500" />
            <span>Resetar rotacao desta pagina</span>
          </button>

          <button
            onClick={handleResetAll}
            disabled={!hasRotations}
            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={14} className="mr-2" />
            <span>Resetar todas as rotacoes</span>
            {hasRotations && (
              <span className="ml-auto text-xs text-red-400">({rotatedPageCount})</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default RotationControls;
