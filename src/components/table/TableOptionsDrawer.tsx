import React, { useState } from 'react';
import { X, Upload, Trash2, AlertCircle } from 'lucide-react';
import { TableImportUpload } from './TableImportUpload';
import type { ParsedTableData } from '../../types/ProcessTable';

interface TableOptionsDrawerProps {
  hasTable: boolean;
  importing: boolean;
  onImport: (parsed: ParsedTableData, name: string) => Promise<void>;
  onDeleteTable: () => Promise<void>;
  onClose: () => void;
}

export function TableOptionsDrawer({
  hasTable,
  importing,
  onImport,
  onDeleteTable,
  onClose,
}: TableOptionsDrawerProps) {
  const [view, setView] = useState<'menu' | 'import' | 'delete'>('menu');

  const handleImport = async (parsed: ParsedTableData, name: string) => {
    await onImport(parsed, name);
    onClose();
  };

  const handleDelete = async () => {
    await onDeleteTable();
    setView('menu');
    onClose();
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 z-[60] flex flex-col bg-white border-l border-gray-200 shadow-2xl w-80">
      {view === 'menu' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200 shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Opções da tabela</h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              title="Fechar"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col p-4 gap-2">
            <button
              onClick={() => setView('import')}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all text-left"
            >
              <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                <Upload size={15} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-[13px]">
                  {hasTable ? 'Substituir planilha' : 'Importar planilha'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {hasTable
                    ? 'Carregue uma nova planilha .xlsx ou .csv'
                    : 'Carregue uma planilha .xlsx, .xls ou .csv'}
                </p>
              </div>
            </button>

            {hasTable && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => setView('delete')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all text-left"
                >
                  <div className="p-2 bg-red-50 rounded-lg shrink-0">
                    <Trash2 size={15} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-600 text-[13px]">Excluir tabela</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Remove todos os dados importados</p>
                  </div>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {view === 'import' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setView('menu')}
                className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors shrink-0"
                title="Voltar"
              >
                <X size={15} />
              </button>
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {hasTable ? 'Substituir planilha' : 'Importar planilha'}
              </h3>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {hasTable && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Substituir apagará todos os dados e colunas de fórmula atuais.
                </p>
              </div>
            )}
            <TableImportUpload
              onConfirm={handleImport}
              onCancel={() => setView('menu')}
              isReplacing={hasTable}
              importing={importing}
            />
          </div>
        </>
      )}

      {view === 'delete' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200 shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Excluir tabela</h3>
            <button
              onClick={() => setView('menu')}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              title="Cancelar"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col p-5 gap-5">
            <div className="flex flex-col gap-3">
              <div className="p-3 w-fit bg-red-50 rounded-xl">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Tem certeza?</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Todos os dados importados e colunas de fórmula serão removidos permanentemente.
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Excluir tabela
              </button>
              <button
                onClick={() => setView('menu')}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
