import React, { useState, useMemo } from 'react';
import { X, Sigma } from 'lucide-react';
import type { AggregateOperation, AggregateRow, ProcessTable } from '../../types/ProcessTable';
import {
  OPERATION_LABELS,
  OPERATION_DESCRIPTIONS,
  computeAggregate,
  formatAggregateResult,
  getColumnsForAggregate,
} from '../../utils/aggregateCalculator';

const ALL_OPERATIONS: AggregateOperation[] = [
  'sum', 'average', 'min', 'max', 'count', 'product', 'median', 'stddev',
];

interface AddAggregateRowModalProps {
  table: ProcessTable;
  editingAggregate?: AggregateRow;
  onConfirm: (
    columnId: string,
    operation: AggregateOperation,
    rangeStart: number | null,
    rangeEnd: number | null
  ) => Promise<void>;
  onClose: () => void;
}

export function AddAggregateRowModal({
  table,
  editingAggregate,
  onConfirm,
  onClose,
}: AddAggregateRowModalProps) {
  const availableColumns = useMemo(() => getColumnsForAggregate(table.columns), [table.columns]);

  const [columnId, setColumnId] = useState<string>(
    editingAggregate?.columnId ?? availableColumns[0]?.id ?? ''
  );
  const [operation, setOperation] = useState<AggregateOperation>(
    editingAggregate?.operation ?? 'sum'
  );
  const [useRange, setUseRange] = useState<boolean>(
    editingAggregate ? editingAggregate.rangeStart !== null : false
  );
  const [rangeStartStr, setRangeStartStr] = useState<string>(
    editingAggregate?.rangeStart != null ? String(editingAggregate.rangeStart) : '1'
  );
  const [rangeEndStr, setRangeEndStr] = useState<string>(
    editingAggregate?.rangeEnd != null ? String(editingAggregate.rangeEnd) : String(table.rows.length)
  );
  const [saving, setSaving] = useState(false);

  const rangeStart = useRange ? (parseInt(rangeStartStr, 10) || null) : null;
  const rangeEnd = useRange ? (parseInt(rangeEndStr, 10) || null) : null;

  const previewResult = useMemo(() => {
    if (!columnId) return null;
    const mockAgg: AggregateRow = {
      id: '_preview',
      tableId: table.id,
      columnId,
      operation,
      rangeStart,
      rangeEnd,
      displayOrder: 0,
    };
    const value = computeAggregate(mockAgg, table.rows);
    return formatAggregateResult(value, operation);
  }, [columnId, operation, rangeStart, rangeEnd, table]);

  const selectedColumn = availableColumns.find((c) => c.id === columnId);

  const rangeStartValid = !useRange || (parseInt(rangeStartStr, 10) >= 1);
  const rangeEndValid = !useRange || (parseInt(rangeEndStr, 10) >= 1);
  const rangeOrderValid = !useRange || (parseInt(rangeStartStr, 10) <= parseInt(rangeEndStr, 10));
  const canSave = columnId !== '' && rangeStartValid && rangeEndValid && rangeOrderValid;

  const handleConfirm = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onConfirm(columnId, operation, rangeStart, rangeEnd);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Sigma size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                {editingAggregate ? 'Editar linha de agregação' : 'Nova linha de agregação'}
              </h2>
              <p className="text-xs text-slate-500">Linha fixa no rodapé da tabela</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Coluna</label>
            {availableColumns.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhuma coluna de dados disponível.</p>
            ) : (
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {availableColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.letter} — {col.headerName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Operação</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ALL_OPERATIONS.map((op) => (
                <button
                  key={op}
                  onClick={() => setOperation(op)}
                  title={OPERATION_DESCRIPTIONS[op]}
                  className={`
                    px-2 py-2 rounded-lg text-[10px] font-bold tracking-wide border transition-all
                    ${operation === op
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                    }
                  `}
                >
                  {OPERATION_LABELS[op]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">{OPERATION_DESCRIPTIONS[operation]}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <input
                id="use-range"
                type="checkbox"
                checked={useRange}
                onChange={(e) => setUseRange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
              />
              <label htmlFor="use-range" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                Limitar a um intervalo de linhas
              </label>
            </div>
            {useRange && (
              <div className="flex items-center gap-3 pl-5">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Linha inicial</label>
                  <input
                    type="number"
                    min={1}
                    max={table.rows.length}
                    value={rangeStartStr}
                    onChange={(e) => setRangeStartStr(e.target.value)}
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <span className="text-slate-400 text-xs mt-4">até</span>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Linha final</label>
                  <input
                    type="number"
                    min={1}
                    max={table.rows.length}
                    value={rangeEndStr}
                    onChange={(e) => setRangeEndStr(e.target.value)}
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            )}
            {useRange && !rangeOrderValid && (
              <p className="mt-1.5 pl-5 text-[10px] text-red-500">A linha inicial deve ser menor ou igual à linha final.</p>
            )}
          </div>

          {selectedColumn && previewResult !== null && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Prévia</p>
                <p className="text-xs text-slate-700 mt-0.5">
                  {OPERATION_LABELS[operation]} de <span className="font-semibold">{selectedColumn.headerName}</span>
                  {useRange && rangeStart !== null && rangeEnd !== null && rangeOrderValid
                    ? ` (linhas ${rangeStart}–${rangeEnd})`
                    : ' (coluna inteira)'}
                </p>
              </div>
              <span className="text-base font-bold text-blue-700 font-mono">{previewResult}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSave || saving || availableColumns.length === 0}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : editingAggregate ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
