import React from 'react';
import { FileText } from 'lucide-react';
import PDFSidebar from './PDFSidebar';
import type { PDFViewerSidebarAreaProps } from '../../types/FloatingPDFViewerContracts';

const PDFViewerSidebarArea: React.FC<PDFViewerSidebarAreaProps> = ({ isVisible, width, processId }) => (
  <div
    className={`border-l border-gray-300 bg-gray-50 transition-all duration-300 ease-in-out overflow-hidden ${
      isVisible ? 'opacity-100' : 'opacity-0 w-0'
    }`}
    style={{ width: isVisible ? `${width}px` : '0px' }}
  >
    {processId ? (
      <PDFSidebar processId={processId} />
    ) : (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center text-gray-500">
          <FileText className="mx-auto mb-3 text-gray-400" size={48} />
          <p className="text-sm">Abra um documento de processo para gerenciar registros</p>
        </div>
      </div>
    )}
  </div>
);

export default React.memo(PDFViewerSidebarArea);
