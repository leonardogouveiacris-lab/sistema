import React from 'react';

interface PDFViewerPageNavigationProps {
  currentPage: number;
  totalPages: number;
  isRotating: boolean;
  pageInputValue: string;
  onSetPageInputValue: (value: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onManualNavigation: (page: number) => void;
}

const PDFViewerPageNavigation: React.FC<PDFViewerPageNavigationProps> = ({
  currentPage,
  totalPages,
  isRotating,
  pageInputValue,
  onSetPageInputValue,
  onPreviousPage,
  onNextPage,
  onManualNavigation,
}) => (
  <div className="flex items-center space-x-1">
    <button
      onClick={onPreviousPage}
      disabled={currentPage <= 1 || isRotating}
      className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      title="Página anterior"
    >
      ←
    </button>

    <input
      type="number"
      value={pageInputValue || currentPage}
      onChange={(e) => onSetPageInputValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (isRotating) return;
          const page = parseInt(pageInputValue) || currentPage;
          onManualNavigation(page);
          onSetPageInputValue('');
          (e.target as HTMLInputElement).blur();
        }
      }}
      onBlur={() => onSetPageInputValue('')}
      onFocus={(e) => {
        onSetPageInputValue(String(currentPage));
        e.target.select();
      }}
      className="w-12 sm:w-14 px-1 sm:px-2 py-1 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      min={1}
      max={totalPages}
    />

    <button
      onClick={onNextPage}
      disabled={currentPage >= totalPages || isRotating}
      className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      title="Próxima página"
    >
      →
    </button>
  </div>
);

export default React.memo(PDFViewerPageNavigation);
