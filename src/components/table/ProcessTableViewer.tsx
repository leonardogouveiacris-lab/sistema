import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Pencil,
  Calculator,
  MoreVertical,
  Check,
  X,
  Copy,
} from 'lucide-react';
import { evaluateFormula, formatFormulaResult } from '../../utils/formulaEvaluator';
import { AddFormulaColumnModal } from './AddFormulaColumnModal';
import type { ProcessTable, ProcessTableColumn, ProcessTableRow } from '../../types/ProcessTable';

interface ProcessTableViewerProps {
  table: ProcessTable;
  onEditCell: (rowId: string, columnId: string, value: string | null) => Promise<void>;
  onAddFormula: (headerName: string, expression: string) => Promise<void>;
  onEditFormula: (columnId: string, headerName: string, expression: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
  onReplaceTable: () => void;
  onDeleteTable: () => void;
  onCopyCellRef?: (ref: string) => void;
}

interface EditingCell {
  rowId: string;
  columnId: string;
  value: string;
}

interface ActiveColumn {
  id: string;
  action: 'menu' | 'edit-header';
}

export function ProcessTableViewer({
  table,
  onEditCell,
  onAddFormula,
  onEditFormula,
  onDeleteColumn,
  onReplaceTable,
  onDeleteTable,
  onCopyCellRef,
}: ProcessTableViewerProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<ActiveColumn | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [editingFormulaCol, setEditingFormulaCol] = useState<ProcessTableColumn | null>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);

  const cellInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const sortedColumns = useMemo(
    () => [...table.columns].sort((a, b) => a.index - b.index),
    [table.columns]
  );

  const getCellRef = useCallback(
    (column: ProcessTableColumn, rowIndex: number) => `${column.letter}${rowIndex}`,
    []
  );

  const getCellValue = useCallback(
    (row: ProcessTableRow, column: ProcessTableColumn): string => {
      if (column.type === 'formula' && column.formulaExpression) {
        const result = evaluateFormula(column.formulaExpression, table.columns, row);
        return formatFormulaResult(result);
      }
      return row.cells[column.id] ?? '';
    },
    [table.columns]
  );

  const startEdit = useCallback(
    (row: ProcessTableRow, column: ProcessTableColumn) => {
      if (column.type === 'formula') return;
      setEditingCell({
        rowId: row.id,
        columnId: column.id,
        value: row.cells[column.id] ?? '',
      });
      setTimeout(() => cellInputRef.current?.select(), 0);
    },
    []
  );

  const commitEdit = useCallback(async () => {
    if (!editingCell) return;
    const key = `${editingCell.rowId}-${editingCell.columnId}`;
    setSavingCell(key);
    try {
      await onEditCell(editingCell.rowId, editingCell.columnId, editingCell.value || null);
    } finally {
      setSavingCell(null);
      setEditingCell(null);
    }
  }, [editingCell, onEditCell]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') cancelEdit();
    },
    [commitEdit, cancelEdit]
  );

  const handleCellClick = useCallback(
    (row: ProcessTableRow, column: ProcessTableColumn) => {
      const ref = getCellRef(column, row.rowIndex);
      setHighlightedCell(ref);
      if (onCopyCellRef) {
        onCopyCellRef(ref);
      }
    },
    [getCellRef, onCopyCellRef]
  );

  const handleAddFormula = async (headerName: string, expression: string) => {
    await onAddFormula(headerName, expression);
    setShowFormulaModal(false);
  };

  const handleEditFormulaConfirm = async (headerName: string, expression: string) => {
    if (!editingFormulaCol) return;
    await onEditFormula(editingFormulaCol.id, headerName, expression);
    setEditingFormulaCol(null);
  };

  return (
    <div className="flex flex-col gap-0 h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{table.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {table.rows.length} linhas · {table.columns.length} colunas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormulaModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600
                       bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <Calculator size={13} />
            Nova fórmula
          </button>
          <div className="relative">
            <button
              onClick={() => setShowTableMenu((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {showTableMenu && (
              <TableMenu
                onReplace={() => { setShowTableMenu(false); onReplaceTable(); }}
                onDelete={() => { setShowTableMenu(false); onDeleteTable(); }}
                onClose={() => setShowTableMenu(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div
        ref={tableContainerRef}
        className="overflow-auto flex-1 relative"
        onClick={() => { setActiveColumn(null); setShowTableMenu(false); }}
      >
        <table className="border-collapse text-xs select-none min-w-max">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 w-10 min-w-[2.5rem] bg-slate-100 border-b border-r border-slate-300 text-slate-400 font-normal text-center" />
              {sortedColumns.map((col) => (
                <ColumnHeader
                  key={col.id}
                  column={col}
                  isActive={activeColumn?.id === col.id}
                  onMenuToggle={(id) => setActiveColumn((prev) => prev?.id === id ? null : { id, action: 'menu' })}
                  onEditFormula={(c) => { setEditingFormulaCol(c); setActiveColumn(null); }}
                  onDeleteColumn={(id) => { onDeleteColumn(id); setActiveColumn(null); }}
                  showMenu={activeColumn?.id === col.id && activeColumn.action === 'menu'}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} className="group hover:bg-blue-50/30 transition-colors">
                <td className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 text-slate-400 text-center py-1.5 px-2 font-mono text-[10px] min-w-[2.5rem] group-hover:bg-slate-100">
                  {row.rowIndex}
                </td>
                {sortedColumns.map((col) => {
                  const cellRef = getCellRef(col, row.rowIndex);
                  const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id;
                  const isSaving = savingCell === `${row.id}-${col.id}`;
                  const isHighlighted = highlightedCell === cellRef;
                  const value = getCellValue(row, col);
                  const isFormula = col.type === 'formula';

                  return (
                    <td
                      key={col.id}
                      onDoubleClick={() => startEdit(row, col)}
                      onClick={() => handleCellClick(row, col)}
                      title={isFormula ? undefined : `${cellRef}: ${value}`}
                      className={`
                        border-b border-r border-slate-200 relative
                        min-w-[80px] max-w-[200px] h-8
                        ${isFormula ? 'bg-emerald-50/40 cursor-default' : 'cursor-cell hover:bg-blue-50/50'}
                        ${isHighlighted ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}
                        ${isSaving ? 'opacity-50' : ''}
                        transition-colors
                      `}
                    >
                      {isEditing ? (
                        <div className="flex items-center absolute inset-0 z-10 bg-white ring-2 ring-inset ring-blue-500">
                          <input
                            ref={cellInputRef}
                            autoFocus
                            value={editingCell.value}
                            onChange={(e) => setEditingCell((prev) => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyDown={handleKeyDown}
                            onBlur={commitEdit}
                            className="flex-1 px-2 text-xs text-slate-800 bg-transparent outline-none font-mono"
                          />
                          <div className="flex shrink-0">
                            <button onMouseDown={(e) => { e.preventDefault(); commitEdit(); }}
                              className="p-1 hover:bg-emerald-100 text-emerald-600">
                              <Check size={12} />
                            </button>
                            <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                              className="p-1 hover:bg-red-100 text-red-500">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span
                          className={`
                            block truncate px-2 py-1.5 text-xs leading-tight
                            ${isFormula ? 'text-emerald-700 font-medium' : 'text-slate-700'}
                          `}
                        >
                          {value ?? ''}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {highlightedCell && onCopyCellRef && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
          <span>Célula selecionada:</span>
          <span className="font-mono font-semibold">{highlightedCell}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(highlightedCell); }}
            className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 hover:bg-blue-200 rounded text-blue-700 transition-colors"
          >
            <Copy size={11} />
            Copiar referência
          </button>
        </div>
      )}

      {showFormulaModal && (
        <AddFormulaColumnModal
          table={table}
          onConfirm={handleAddFormula}
          onClose={() => setShowFormulaModal(false)}
        />
      )}

      {editingFormulaCol && (
        <AddFormulaColumnModal
          table={table}
          editingColumn={editingFormulaCol}
          onConfirm={handleEditFormulaConfirm}
          onClose={() => setEditingFormulaCol(null)}
        />
      )}
    </div>
  );
}

interface ColumnHeaderProps {
  column: ProcessTableColumn;
  isActive: boolean;
  showMenu: boolean;
  onMenuToggle: (id: string) => void;
  onEditFormula: (col: ProcessTableColumn) => void;
  onDeleteColumn: (id: string) => void;
}

function ColumnHeader({ column, showMenu, onMenuToggle, onEditFormula, onDeleteColumn }: ColumnHeaderProps) {
  const isFormula = column.type === 'formula';

  return (
    <th
      className={`
        relative px-2 py-2 border-b border-r border-slate-300 font-medium text-left whitespace-nowrap
        min-w-[80px] max-w-[200px]
        ${isFormula ? 'bg-emerald-100/60' : 'bg-slate-100'}
      `}
    >
      <div className="flex items-center gap-1.5 group/header">
        <span className={`font-mono text-[10px] font-bold shrink-0 ${isFormula ? 'text-emerald-700' : 'text-blue-600'}`}>
          {column.letter}
        </span>
        <span className="text-slate-700 text-[11px] truncate flex-1" title={column.headerName}>
          {column.headerName || '(sem nome)'}
        </span>
        {isFormula && (
          <span className="text-[9px] font-mono text-emerald-600 bg-emerald-100 px-1 rounded shrink-0">fx</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(column.id); }}
          className="p-0.5 rounded opacity-0 group-hover/header:opacity-100 hover:bg-slate-200 text-slate-500 transition-all shrink-0"
        >
          <MoreVertical size={11} />
        </button>
      </div>

      {isFormula && column.formulaExpression && (
        <div className="text-[10px] font-mono text-emerald-500 truncate mt-0.5">
          = {column.formulaExpression}
        </div>
      )}

      {showMenu && (
        <div
          className="absolute top-full left-0 z-40 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          {isFormula && (
            <button
              onClick={() => onEditFormula(column)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Pencil size={13} className="text-slate-400" />
              Editar fórmula
            </button>
          )}
          <button
            onClick={() => onDeleteColumn(column.id)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            Remover coluna
          </button>
        </div>
      )}
    </th>
  );
}

interface TableMenuProps {
  onReplace: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function TableMenu({ onReplace, onDelete, onClose }: TableMenuProps) {
  return (
    <div
      className="absolute top-full right-0 z-40 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[180px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onReplace}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Upload size={13} className="text-slate-400" />
        Substituir tabela
      </button>
      <div className="my-1 border-t border-slate-100" />
      <button
        onClick={onDelete}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={13} />
        Excluir tabela
      </button>
    </div>
  );
}
