import React from 'react';
import type { PDFViewerHeaderProps } from '../../types/FloatingPDFViewerContracts';

const PDFViewerHeader: React.FC<PDFViewerHeaderProps> = ({
  documents,
  currentPage,
  totalPages,
  zoom,
  onMinimize,
  onClose,
}) => (
  <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-gray-900 truncate">
        {documents.length === 1
          ? documents[0]?.fileName || 'Documento'
          : `${documents.length} Documentos (Visualizador Unificado)`}
      </h3>
      <p className="text-xs text-gray-600">
        Página {currentPage} de {totalPages} • Zoom: {Math.round(zoom * 100)}%
      </p>
    </div>

    <div className="flex items-center space-x-2 ml-4">
      <button
        onClick={onMinimize}
        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors duration-200"
        title="Minimizar"
      >
        <span className="text-lg">−</span>
      </button>
      <button
        onClick={onClose}
        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors duration-200"
        title="Fechar"
      >
        <span className="text-lg">×</span>
      </button>
    </div>
  </div>
);

export default React.memo(PDFViewerHeader);
