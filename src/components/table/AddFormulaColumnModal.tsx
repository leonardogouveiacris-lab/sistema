import React, { useState, useMemo, useCallback } from 'react';
import { X, Calculator, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { validateFormulaExpression, evaluateFormula } from '../../utils/formulaEvaluator';
import { columnIndexToLetter } from '../../utils/tableParser';
import type { ProcessTable, ProcessTableColumn } from '../../types/ProcessTable';

interface AddFormulaColumnModalProps {
  table: ProcessTable;
  editingColumn?: ProcessTableColumn | null;
  onConfirm: (headerName: string, expression: string) => Promise<void>;
  onClose: () => void;
}

export function AddFormulaColumnModal({
  table,
  editingColumn,
  onConfirm,
  onClose,
}: AddFormulaColumnModalProps) {
  const [headerName, setHeaderName] = useState(editingColumn?.headerName ?? '');
  const [expression, setExpression] = useState(editingColumn?.formulaExpression ?? '');
  const [saving, setSaving] = useState(false);

  const dataColumns = useMemo(
    () => table.columns.filter((c) => c.type === 'data'),
    [table.columns]
  );

  const availableLetters = useMemo(
    () => dataColumns.map((c) => c.letter),
    [dataColumns]
  );

  const validation = useMemo(() => {
    if (!expression.trim()) return null;
    return validateFormulaExpression(expression, availableLetters);
  }, [expression, availableLetters]);

  const previewRows = useMemo(() => {
    if (!validation?.valid || !expression.trim()) return [];
    const rows = table.rows.slice(0, 5);
    return rows.map((row) => {
      const result = evaluateFormula(expression, table.columns, row);
      return { rowIndex: row.rowIndex, result };
    });
  }, [validation, expression, table.columns, table.rows]);

  const insertLetter = useCallback((letter: string) => {
    setExpression((prev) => prev + letter);
  }, []);

  const handleSubmit = async () => {
    if (!validation?.valid || !headerName.trim()) return;
    setSaving(true);
    try {
      await onConfirm(headerName.trim(), expression.trim().toUpperCase());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!editingColumn;
  const canSubmit = validation?.valid && headerName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calculator size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {isEditing ? 'Editar coluna de fórmula' : 'Nova coluna de fórmula'}
              </h2>
              <p className="text-xs text-slate-500">Calcule valores com base nas colunas existentes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Nome da coluna</label>
            <input
              type="text"
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              placeholder="Ex: Diferença, Total, Resultado..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800
                         placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Expressão da fórmula</label>

            <div className="flex flex-wrap gap-1.5 mb-1">
              {dataColumns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => insertLetter(col.letter)}
                  className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 hover:bg-blue-100
                             hover:text-blue-700 text-slate-700 rounded-md transition-colors border border-slate-200
                             hover:border-blue-300"
                  title={col.headerName}
                >
                  {col.letter}
                </button>
              ))}
              {['+', '-', '*', '/', '(', ')'].map((op) => (
                <button
                  key={op}
                  onClick={() => insertLetter(op)}
                  className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 hover:bg-slate-200
                             text-slate-600 rounded-md transition-colors border border-slate-200"
                >
                  {op}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value.toUpperCase())}
              placeholder="Ex: C-D  ou  (C+D)*2  ou  (A-B)/C"
              className={`
                w-full border rounded-lg px-3 py-2.5 text-sm font-mono text-slate-800
                placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all
                ${validation === null
                  ? 'border-slate-200 focus:ring-blue-500'
                  : validation.valid
                  ? 'border-emerald-300 bg-emerald-50/40 focus:ring-emerald-500'
                  : 'border-red-300 bg-red-50/40 focus:ring-red-500'
                }
              `}
            />

            {validation !== null && (
              <div className={`flex items-start gap-2 text-xs ${validation.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                {validation.valid
                  ? <CheckCircle size={13} className="mt-0.5 shrink-0" />
                  : <AlertCircle size={13} className="mt-0.5 shrink-0" />
                }
                <span>{validation.valid ? 'Expressão válida' : validation.error}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Info size={13} className="text-slate-400 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-500 leading-relaxed">
              Use as letras das colunas como variáveis. Os operadores suportados são{' '}
              <span className="font-mono font-semibold">+ - * /</span> e parênteses.
              <br />
              Exemplo: <span className="font-mono font-semibold text-slate-700">((C+D)*2)-E</span>
            </div>
          </div>

          {previewRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-600">Preview (primeiras linhas):</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-2 text-slate-500 font-medium border-b border-slate-200">Linha</th>
                      {dataColumns.slice(0, 4).map((col) => (
                        <th key={col.id} className="text-right px-3 py-2 text-slate-500 font-medium border-b border-slate-200">
                          <span className="font-mono text-blue-600">{col.letter}</span>
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 text-emerald-700 font-semibold border-b border-slate-200 bg-emerald-50">
                        {headerName || 'Resultado'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(({ rowIndex, result }, i) => {
                      const row = table.rows[i];
                      return (
                        <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 text-slate-400">{rowIndex}</td>
                          {dataColumns.slice(0, 4).map((col) => (
                            <td key={col.id} className="px-3 py-2 text-right text-slate-600 font-mono">
                              {row?.cells[col.id] ?? '—'}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold font-mono bg-emerald-50/40">
                            {result || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
                       rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEditing ? 'Salvar alterações' : 'Adicionar coluna'}
          </button>
        </div>
      </div>
    </div>
  );
}
