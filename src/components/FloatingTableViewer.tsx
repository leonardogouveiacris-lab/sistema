import React from 'react';
import { Table as TableIcon, FileText, X, Minus } from 'lucide-react';
import { useTableViewer } from '../contexts/TableViewerContext';
import { usePDFViewer } from '../contexts/PDFViewerContext';
import { TabelaTab } from './table';

interface FloatingTableViewerProps {
  processId?: string;
}

const FloatingTableViewer: React.FC<FloatingTableViewerProps> = ({ processId }) => {
  const { state, closeTableViewer, toggleMinimize } = useTableViewer();
  const { state: pdfState, toggleMinimize: pdfToggleMinimize } = usePDFViewer();

  const effectiveProcessId = state.processId || processId || '';

  if (!state.isOpen || !effectiveProcessId) return null;

  const panelWidth = pdfState.panelWidth || Math.min(Math.floor(window.innerWidth * 0.45), 900);
  const pdfIsVisiblePanel = pdfState.isOpen && !pdfState.isMinimized;

  if (state.isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[52]"
        style={pdfIsVisiblePanel ? { right: `${panelWidth + 16}px` } : undefined}
      >
        <button
          onClick={toggleMinimize}
          className="flex items-center space-x-2 px-4 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow-lg transition-colors duration-200"
          title="Expandir tabela"
        >
          <TableIcon size={18} />
          <span className="font-medium text-sm">Tabela de Dados</span>
        </button>
      </div>
    );
  }

  const handleSwitchToPDF = () => {
    toggleMinimize();
    if (pdfState.isMinimized) {
      pdfToggleMinimize();
    }
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-white shadow-2xl z-[51] flex flex-col notranslate"
      style={{ width: panelWidth }}
    >
      {pdfIsVisiblePanel && (
        <div className="flex items-center shrink-0 border-b border-gray-200 bg-gray-50">
          <button
            onClick={handleSwitchToPDF}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border-b-2 border-transparent"
          >
            <FileText size={13} />
            PDF
          </button>
          <div className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-blue-700 border-b-2 border-blue-600 bg-white">
            <TableIcon size={13} />
            Tabela
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TableIcon size={16} className="text-slate-600 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">Tabela de Dados</h3>
            <p className="text-xs text-gray-500">Planilha importada do processo</p>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-4 shrink-0">
          <button
            onClick={toggleMinimize}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors duration-200"
            title="Minimizar"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={closeTableViewer}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors duration-200"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <TabelaTab processId={effectiveProcessId} />
      </div>
    </div>
  );
};

export default FloatingTableViewer;
