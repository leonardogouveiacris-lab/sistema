import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Trash2,
  Upload,
  Pencil,
  Calculator,
  MoreVertical,
  Check,
  X,
  Copy,
  Type,
} from 'lucide-react';
import { evaluateFormula, formatFormulaResult, formatCellNumber } from '../../utils/formulaEvaluator';
import { AddFormulaColumnModal } from './AddFormulaColumnModal';
import type { ProcessTable, ProcessTableColumn, ProcessTableRow } from '../../types/ProcessTable';

const COL_WIDTH = 100;
const ROW_NUM_WIDTH = 36;

interface ProcessTableViewerProps {
  table: ProcessTable;
  onEditCell: (rowId: string, columnId: string, value: string | null) => Promise<void>;
  onAddFormula: (headerName: string, expression: string) => Promise<void>;
  onEditFormula: (columnId: string, headerName: string, expression: string) => Promise<void>;
  onRenameColumn: (columnId: string, headerName: string) => Promise<void>;
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

interface FocusedCell {
  rowIndex: number;
  colIndex: number;
}

export function ProcessTableViewer({
  table,
  onEditCell,
  onAddFormula,
  onEditFormula,
  onRenameColumn,
  onDeleteColumn,
  onReplaceTable,
  onDeleteTable,
  onCopyCellRef,
}: ProcessTableViewerProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [editingFormulaCol, setEditingFormulaCol] = useState<ProcessTableColumn | null>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [highlightedRef, setHighlightedRef] = useState<string | null>(null);

  const cellInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);

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
      const raw = row.cells[column.id] ?? '';
      return formatCellNumber(raw);
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

  const commitRename = useCallback(async () => {
    if (!renamingColId) return;
    const trimmed = renamingValue.trim();
    if (trimmed) {
      await onRenameColumn(renamingColId, trimmed);
    }
    setRenamingColId(null);
    setRenamingValue('');
  }, [renamingColId, renamingValue, onRenameColumn]);

  const cancelRename = useCallback(() => {
    setRenamingColId(null);
    setRenamingValue('');
  }, []);

  useEffect(() => {
    if (renamingColId) {
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [renamingColId]);

  const scrollCellIntoView = useCallback((rowIndex: number, colIndex: number) => {
    const container = tableContainerRef.current;
    if (!container) return;

    const cellTop = rowIndex * 32;
    const cellLeft = ROW_NUM_WIDTH + colIndex * COL_WIDTH;
    const cellBottom = cellTop + 32;
    const cellRight = cellLeft + COL_WIDTH;

    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const visibleBottom = scrollTop + container.clientHeight;
    const visibleRight = scrollLeft + container.clientWidth;

    if (cellBottom > visibleBottom) {
      container.scrollTop = cellBottom - container.clientHeight + 4;
    } else if (cellTop < scrollTop + 32) {
      container.scrollTop = cellTop - 32;
    }

    if (cellRight > visibleRight) {
      container.scrollLeft = cellRight - container.clientWidth + 4;
    } else if (cellLeft < scrollLeft + ROW_NUM_WIDTH) {
      container.scrollLeft = cellLeft - ROW_NUM_WIDTH;
    }
  }, []);

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) return;
      if (!focusedCell) return;

      const { rowIndex, colIndex } = focusedCell;
      const numRows = table.rows.length;
      const numCols = sortedColumns.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(rowIndex + 1, numRows - 1);
        setFocusedCell({ rowIndex: next, colIndex });
        scrollCellIntoView(next, colIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(rowIndex - 1, 0);
        setFocusedCell({ rowIndex: next, colIndex });
        scrollCellIntoView(next, colIndex);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(colIndex + 1, numCols - 1);
        setFocusedCell({ rowIndex, colIndex: next });
        scrollCellIntoView(rowIndex, next);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = Math.max(colIndex - 1, 0);
        setFocusedCell({ rowIndex, colIndex: next });
        scrollCellIntoView(rowIndex, next);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (colIndex > 0) {
            setFocusedCell({ rowIndex, colIndex: colIndex - 1 });
            scrollCellIntoView(rowIndex, colIndex - 1);
          } else if (rowIndex > 0) {
            setFocusedCell({ rowIndex: rowIndex - 1, colIndex: numCols - 1 });
            scrollCellIntoView(rowIndex - 1, numCols - 1);
          }
        } else {
          if (colIndex < numCols - 1) {
            setFocusedCell({ rowIndex, colIndex: colIndex + 1 });
            scrollCellIntoView(rowIndex, colIndex + 1);
          } else if (rowIndex < numRows - 1) {
            setFocusedCell({ rowIndex: rowIndex + 1, colIndex: 0 });
            scrollCellIntoView(rowIndex + 1, 0);
          }
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        const row = table.rows[rowIndex];
        const col = sortedColumns[colIndex];
        if (row && col) startEdit(row, col);
      }
    },
    [editingCell, focusedCell, table.rows, sortedColumns, startEdit, scrollCellIntoView]
  );

  const handleCellClick = useCallback(
    (row: ProcessTableRow, column: ProcessTableColumn, rowIdx: number, colIdx: number) => {
      const ref = getCellRef(column, row.rowIndex);
      setHighlightedRef(ref);
      setFocusedCell({ rowIndex: rowIdx, colIndex: colIdx });
      if (onCopyCellRef) onCopyCellRef(ref);
    },
    [getCellRef, onCopyCellRef]
  );

  const handleEditCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') cancelEdit();
    },
    [commitEdit, cancelEdit]
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

  const closeAllMenus = useCallback(() => {
    setActiveColumnMenu(null);
    setShowTableMenu(false);
  }, []);

  return (
    <div
      className="flex flex-col gap-0 h-full outline-none"
      tabIndex={0}
      onKeyDown={handleTableKeyDown}
      ref={tableWrapperRef}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
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
        onClick={closeAllMenus}
      >
        <table
          className="border-collapse text-xs select-none"
          style={{ tableLayout: 'fixed', minWidth: ROW_NUM_WIDTH + sortedColumns.length * COL_WIDTH }}
        >
          <colgroup>
            <col style={{ width: ROW_NUM_WIDTH }} />
            {sortedColumns.map((col) => (
              <col key={col.id} style={{ width: COL_WIDTH }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 overflow-visible">
            <tr>
              <th
                className="sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-300 text-slate-400 font-normal text-center"
                style={{ width: ROW_NUM_WIDTH }}
              />
              {sortedColumns.map((col, colIdx) => (
                <ColumnHeader
                  key={col.id}
                  column={col}
                  colIdx={colIdx}
                  isRenaming={renamingColId === col.id}
                  renamingValue={renamingValue}
                  renameInputRef={renameInputRef}
                  onRenamingValueChange={setRenamingValue}
                  onCommitRename={commitRename}
                  onCancelRename={cancelRename}
                  showMenu={activeColumnMenu === col.id}
                  onMenuToggle={(id) => setActiveColumnMenu((prev) => prev === id ? null : id)}
                  onStartRename={(c) => {
                    setRenamingColId(c.id);
                    setRenamingValue(c.headerName);
                    setActiveColumnMenu(null);
                  }}
                  onEditFormula={(c) => { setEditingFormulaCol(c); setActiveColumnMenu(null); }}
                  onDeleteColumn={(id) => { onDeleteColumn(id); setActiveColumnMenu(null); }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={row.id} className="group hover:bg-blue-50/20 transition-colors">
                <td
                  className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 text-slate-400 text-center py-1.5 px-2 font-mono text-[10px] group-hover:bg-slate-100"
                  style={{ width: ROW_NUM_WIDTH }}
                >
                  {row.rowIndex}
                </td>
                {sortedColumns.map((col, colIdx) => {
                  const cellRef = getCellRef(col, row.rowIndex);
                  const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id;
                  const isSaving = savingCell === `${row.id}-${col.id}`;
                  const isFocused = focusedCell?.rowIndex === rowIdx && focusedCell?.colIndex === colIdx;
                  const isHighlighted = highlightedRef === cellRef;
                  const value = getCellValue(row, col);
                  const isFormula = col.type === 'formula';

                  return (
                    <td
                      key={col.id}
                      onDoubleClick={() => startEdit(row, col)}
                      onClick={() => handleCellClick(row, col, rowIdx, colIdx)}
                      title={isFormula ? undefined : `${cellRef}: ${row.cells[col.id] ?? ''}`}
                      style={{ width: COL_WIDTH }}
                      className={`
                        border-b border-r border-slate-200 relative h-8
                        ${isFormula ? 'bg-emerald-50/40 cursor-default' : 'cursor-cell hover:bg-blue-50/40'}
                        ${isFocused && !isEditing ? 'ring-2 ring-inset ring-blue-500' : ''}
                        ${isHighlighted && !isFocused ? 'bg-blue-50' : ''}
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
                            onKeyDown={handleEditCellKeyDown}
                            onBlur={commitEdit}
                            className="flex-1 px-2 text-xs text-slate-800 bg-transparent outline-none font-mono min-w-0"
                          />
                          <div className="flex shrink-0">
                            <button
                              onMouseDown={(e) => { e.preventDefault(); commitEdit(); }}
                              className="p-1 hover:bg-emerald-100 text-emerald-600"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                              className="p-1 hover:bg-red-100 text-red-500"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span
                          className={`
                            block truncate px-2 py-1.5 text-xs leading-tight text-right
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

      {highlightedRef && onCopyCellRef && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700 shrink-0">
          <span>Célula selecionada:</span>
          <span className="font-mono font-semibold">{highlightedRef}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(highlightedRef); }}
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
  colIdx: number;
  isRenaming: boolean;
  renamingValue: string;
  renameInputRef: React.RefObject<HTMLInputElement>;
  onRenamingValueChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  showMenu: boolean;
  onMenuToggle: (id: string) => void;
  onStartRename: (col: ProcessTableColumn) => void;
  onEditFormula: (col: ProcessTableColumn) => void;
  onDeleteColumn: (id: string) => void;
}

function ColumnHeader({
  column,
  isRenaming,
  renamingValue,
  renameInputRef,
  onRenamingValueChange,
  onCommitRename,
  onCancelRename,
  showMenu,
  onMenuToggle,
  onStartRename,
  onEditFormula,
  onDeleteColumn,
}: ColumnHeaderProps) {
  const isFormula = column.type === 'formula';

  return (
    <th
      className={`
        relative px-2 py-2 border-b border-r border-slate-300 font-medium text-left overflow-visible
        ${isFormula ? 'bg-emerald-100/60' : 'bg-slate-100'}
      `}
      style={{ width: COL_WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      {isRenaming ? (
        <div className="flex items-center gap-1 absolute inset-0 px-1 bg-white ring-2 ring-inset ring-blue-500 z-10">
          <input
            ref={renameInputRef}
            value={renamingValue}
            onChange={(e) => onRenamingValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={onCommitRename}
            className="flex-1 text-xs text-slate-800 bg-transparent outline-none min-w-0"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); onCommitRename(); }}
            className="p-0.5 hover:bg-emerald-100 text-emerald-600 shrink-0"
          >
            <Check size={11} />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onCancelRename(); }}
            className="p-0.5 hover:bg-red-100 text-red-500 shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
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
      )}

      {!isRenaming && isFormula && column.formulaExpression && (
        <div className="text-[10px] font-mono text-emerald-500 truncate mt-0.5">
          = {column.formulaExpression}
        </div>
      )}

      {showMenu && (
        <div
          className="absolute top-full left-0 z-[100] mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[170px]"
          onClick={(e) => e.stopPropagation()}
        >
          {!isFormula && (
            <button
              onClick={() => onStartRename(column)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Type size={13} className="text-slate-400" />
              Renomear coluna
            </button>
          )}
          {isFormula && (
            <button
              onClick={() => onEditFormula(column)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Pencil size={13} className="text-slate-400" />
              Editar fórmula
            </button>
          )}
          <div className="my-1 border-t border-slate-100" />
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

function TableMenu({ onReplace, onDelete }: TableMenuProps) {
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
