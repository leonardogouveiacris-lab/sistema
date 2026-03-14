import React, { useState } from 'react';
import { Table as TableIcon, AlertCircle } from 'lucide-react';
import { useProcessTable } from '../../hooks/useProcessTable';
import { TableImportUpload } from './TableImportUpload';
import { ProcessTableViewer } from './ProcessTableViewer';
import type { ParsedTableData } from '../../types/ProcessTable';

interface TabelaTabProps {
  processId: string;
}

export function TabelaTab({ processId }: TabelaTabProps) {
  const {
    table,
    loading,
    error,
    importing,
    importTableData,
    editCell,
    addFormula,
    editFormula,
    renameColumnHeader,
    removeColumn,
    removeTable,
  } = useProcessTable(processId);

  const [showReplaceUpload, setShowReplaceUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleImport = async (parsed: ParsedTableData, name: string) => {
    await importTableData(parsed, name);
    setShowReplaceUpload(false);
  };

  const handleAddFormula = async (headerName: string, expression: string) => {
    await addFormula({ headerName, expression });
  };

  const handleEditFormula = async (columnId: string, headerName: string, expression: string) => {
    await editFormula(columnId, headerName, expression);
  };

  const handleDeleteTable = async () => {
    await removeTable();
    setShowDeleteConfirm(false);
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

  if (!table && !showReplaceUpload) {
    return (
      <div className="p-6 flex flex-col gap-6">
        <div className="flex items-start gap-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
            <TableIcon size={20} className="text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Nenhuma tabela importada</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Importe uma planilha Excel (.xlsx) ou CSV para este processo. As colunas serão
              identificadas por letras (A, B, C...) e poderão ser referenciadas em Verbas e Decisões.
            </p>
          </div>
        </div>
        <TableImportUpload
          onConfirm={handleImport}
          importing={importing}
        />
      </div>
    );
  }

  if (showReplaceUpload) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Substituir tabela</h3>
          <button
            onClick={() => setShowReplaceUpload(false)}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
        <TableImportUpload
          onConfirm={handleImport}
          onCancel={() => setShowReplaceUpload(false)}
          isReplacing
          importing={importing}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {table && (
        <ProcessTableViewer
          table={table}
          onEditCell={editCell}
          onAddFormula={handleAddFormula}
          onEditFormula={handleEditFormula}
          onRenameColumn={renameColumnHeader}
          onDeleteColumn={removeColumn}
          onReplaceTable={() => setShowReplaceUpload(true)}
          onDeleteTable={() => setShowDeleteConfirm(true)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="p-3 w-fit bg-red-50 rounded-xl">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Excluir tabela</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Todos os dados importados e colunas de fórmula serão removidos permanentemente.
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTable}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Excluir tabela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
