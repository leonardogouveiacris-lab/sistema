import React from 'react';
import { FileText } from 'lucide-react';
import PDFSidebar from './PDFSidebar';
import type { PDFViewerSidebarAreaProps } from '../../types/FloatingPDFViewerContracts';

const PDFViewerSidebarArea: React.FC<PDFViewerSidebarAreaProps> = ({ isVisible, width, processId, onResizeStart }) => (
  <div
    className={`relative border-l border-gray-300 bg-gray-50 transition-[opacity,width] duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
      isVisible ? 'opacity-100' : 'opacity-0 w-0'
    }`}
    style={{ width: isVisible ? `${width}px` : '0px' }}
  >
    {isVisible && onResizeStart && (
      <div
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group flex items-center justify-center select-none"
        title="Arrastar para redimensionar painel"
      >
        <div className="w-0.5 h-10 rounded-full bg-gray-300 group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors duration-150" />
      </div>
    )}

    <div className="h-full overflow-hidden">
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
  </div>
);

export default React.memo(PDFViewerSidebarArea);
