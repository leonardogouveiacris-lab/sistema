import React from 'react';
import { FileText } from 'lucide-react';
import type { PDFViewerMinimizedButtonProps } from '../../types/FloatingPDFViewerContracts';

const PDFViewerMinimizedButton: React.FC<PDFViewerMinimizedButtonProps> = ({ documents, currentPage, totalPages, onExpand }) => (
  <div className="fixed bottom-4 right-4 z-50">
    <button
      onClick={onExpand}
      className="flex items-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200"
      title="Expandir visualizador de PDF"
    >
      <FileText size={18} />
      <span className="font-medium">
        {documents.length === 1
          ? documents[0]?.displayName || 'Documento'
          : `${documents.length} Documentos`}
      </span>
      <span className="text-xs opacity-75">({currentPage}/{totalPages})</span>
    </button>
  </div>
);

export default React.memo(PDFViewerMinimizedButton);
