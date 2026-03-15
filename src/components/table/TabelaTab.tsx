import React from 'react';
import { Table as TableIcon, AlertCircle } from 'lucide-react';
import { useProcessTable } from '../../hooks/useProcessTable';
import { ProcessTableViewer } from './ProcessTableViewer';

interface TabelaTabProps {
  processId: string;
  onImportRequest?: () => void;
}

export function TabelaTab({ processId, onImportRequest }: TabelaTabProps) {
  const {
    table,
    loading,
    error,
    editCell,
    addFormula,
    editFormula,
    renameColumnHeader,
    removeColumn,
  } = useProcessTable(processId);

  const handleAddFormula = async (headerName: string, expression: string) => {
    await addFormula({ headerName, expression });
  };

  const handleEditFormula = async (columnId: string, headerName: string, expression: string) => {
    await editFormula(columnId, headerName, expression);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Carregando tabela...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
        <div className="p-4 bg-slate-100 rounded-2xl">
          <TableIcon size={28} className="text-slate-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Nenhuma tabela importada</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xs">
            Importe uma planilha Excel (.xlsx) ou CSV pelo menu lateral. As colunas poderão ser referenciadas em Verbas e Decisões.
          </p>
        </div>
        {onImportRequest && (
          <button
            onClick={onImportRequest}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Importar planilha
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProcessTableViewer
        table={table}
        onEditCell={editCell}
        onAddFormula={handleAddFormula}
        onEditFormula={handleEditFormula}
        onRenameColumn={renameColumnHeader}
        onDeleteColumn={removeColumn}
      />
    </div>
  );
}
