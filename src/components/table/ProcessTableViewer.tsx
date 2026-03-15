import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calculator,
  MoreVertical,
  Check,
  X,
  Trash2,
  Type,
  Pencil,
} from 'lucide-react';
import { evaluateFormula, formatFormulaResult, formatCellNumber } from '../../utils/formulaEvaluator';
import { AddFormulaColumnModal } from './AddFormulaColumnModal';
import { TableMathBar } from './TableMathBar';
import Tooltip from '../ui/Tooltip';
import type { ProcessTable, ProcessTableColumn, ProcessTableRow } from '../../types/ProcessTable';

const COL_WIDTH = 100.06;
const ROW_NUM_WIDTH = 36;

interface ProcessTableViewerProps {
  table: ProcessTable;
  onEditCell: (rowId: string, columnId: string, value: string | null) => Promise<void>;
  onAddFormula: (headerName: string, expression: string) => Promise<void>;
  onEditFormula: (columnId: string, headerName: string, expression: string) => Promise<void>;
  onRenameColumn: (columnId: string, headerName: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
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
  onStartRename: (c: ProcessTableColumn) => void;
  onEditFormula: (c: ProcessTableColumn) => void;
  onDeleteColumn: (id: string) => void;
  isColumnSelected: boolean;
  onColumnHeaderClick: (colIdx: number, letter: string, shiftKey: boolean) => void;
}

function ColumnHeader({
  column,
  colIdx,
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
  isColumnSelected,
  onColumnHeaderClick,
}: ColumnHeaderProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!showMenu && menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
      }
      onMenuToggle(column.id);
    },
    [showMenu, onMenuToggle, column.id]
  );

  const isFormula = column.type === 'formula';

  return (
    <th
      className={`
        border-b border-r border-slate-300 overflow-visible relative group
        ${isColumnSelected ? 'bg-blue-100' : isFormula ? 'bg-emerald-50' : 'bg-slate-100'}
        cursor-pointer select-none
      `}
      style={{ width: COL_WIDTH }}
    >
      {isRenaming ? (
        <div className="flex items-center px-1 py-0.5">
          <input
            ref={renameInputRef}
            value={renamingValue}
            onChange={(e) => onRenamingValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={onCommitRename}
            className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 outline-none bg-white"
            autoFocus
          />
        </div>
      ) : (
        <div className="flex flex-col">
          <div
            className="flex items-center justify-center gap-1 px-1 pt-1 pb-0.5"
            onClick={(e) => onColumnHeaderClick(colIdx, column.letter, e.shiftKey)}
          >
            <span
              className={`font-mono text-[10px] font-bold tracking-wider ${isFormula ? 'text-emerald-600' : 'text-blue-500'}`}
            >
              {column.letter}
            </span>
            {isFormula && (
              <span className="text-[8px] font-bold text-emerald-500 bg-emerald-100 px-0.5 rounded">fx</span>
            )}
          </div>
          <div className="flex items-center justify-between px-1 pb-0.5 min-h-[18px]">
            <Tooltip content={column.headerName}>
              <span className="text-[10px] text-slate-600 truncate flex-1 text-center">
                {column.headerName}
              </span>
            </Tooltip>
            <button
              ref={menuButtonRef}
              onClick={handleMenuToggle}
              className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 transition-opacity"
            >
              <MoreVertical size={10} className="text-slate-500" />
            </button>
          </div>
          {isFormula && column.formulaExpression && (
            <div className="px-1 pb-0.5">
              <span className="text-[9px] text-emerald-500 font-mono truncate block">
                = {column.formulaExpression}
              </span>
            </div>
          )}
        </div>
      )}

      {showMenu &&
        menuPos &&
        createPortal(
          <div
            className="fixed bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] py-1 min-w-[150px]"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onStartRename(column)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Type size={12} />
              Renomear coluna
            </button>
            {isFormula && (
              <button
                onClick={() => onEditFormula(column)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={12} />
                Editar fórmula
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button
              onClick={() => onDeleteColumn(column.id)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} />
              Remover coluna
            </button>
          </div>,
          document.body
        )}
    </th>
  );
}

export function ProcessTableViewer({
  table,
  onEditCell,
  onAddFormula,
  onEditFormula,
  onRenameColumn,
  onDeleteColumn,
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

  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [selectionAnchorRef, setSelectionAnchorRef] = useState<string | null>(null);

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
    if (trimmed) await onRenameColumn(renamingColId, trimmed);
    setRenamingColId(null);
    setRenamingValue('');
  }, [renamingColId, renamingValue, onRenameColumn]);

  const cancelRename = useCallback(() => {
    setRenamingColId(null);
    setRenamingValue('');
  }, []);

  useEffect(() => {
    if (renamingColId) setTimeout(() => renameInputRef.current?.select(), 0);
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
    if (cellBottom > visibleBottom) container.scrollTop = cellBottom - container.clientHeight + 4;
    else if (cellTop < scrollTop + 32) container.scrollTop = cellTop - 32;
    if (cellRight > visibleRight) container.scrollLeft = cellRight - container.clientWidth + 4;
    else if (cellLeft < scrollLeft + ROW_NUM_WIDTH) container.scrollLeft = cellLeft - ROW_NUM_WIDTH;
  }, []);

  const buildRangeBetween = useCallback(
    (anchorRef: string, targetRef: string): Set<string> => {
      const anchorMatch = anchorRef.match(/^([A-Z]+)(\d+)$/);
      const targetMatch = targetRef.match(/^([A-Z]+)(\d+)$/);
      if (!anchorMatch || !targetMatch) return new Set([anchorRef]);

      const anchorLetter = anchorMatch[1];
      const anchorRow = parseInt(anchorMatch[2], 10);
      const targetLetter = targetMatch[1];
      const targetRow = parseInt(targetMatch[2], 10);

      const anchorColIdx = sortedColumns.findIndex((c) => c.letter === anchorLetter);
      const targetColIdx = sortedColumns.findIndex((c) => c.letter === targetLetter);
      if (anchorColIdx === -1 || targetColIdx === -1) return new Set([anchorRef]);

      const minCol = Math.min(anchorColIdx, targetColIdx);
      const maxCol = Math.max(anchorColIdx, targetColIdx);
      const minRow = Math.min(anchorRow, targetRow);
      const maxRow = Math.max(anchorRow, targetRow);

      const refs = new Set<string>();
      for (let ci = minCol; ci <= maxCol; ci++) {
        const col = sortedColumns[ci];
        for (const row of table.rows) {
          if (row.rowIndex >= minRow && row.rowIndex <= maxRow) {
            refs.add(`${col.letter}${row.rowIndex}`);
          }
        }
      }
      return refs;
    },
    [sortedColumns, table.rows]
  );

  const handleCellClick = useCallback(
    (row: ProcessTableRow, column: ProcessTableColumn, rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      if (editingCell) return;
      const ref = getCellRef(column, row.rowIndex);
      setFocusedCell({ rowIndex: rowIdx, colIndex: colIdx });

      if (e.shiftKey && selectionAnchorRef) {
        const range = buildRangeBetween(selectionAnchorRef, ref);
        setSelectedRefs(range);
      } else if (e.ctrlKey || e.metaKey) {
        setSelectedRefs((prev) => {
          const next = new Set(prev);
          if (next.has(ref)) next.delete(ref);
          else next.add(ref);
          return next;
        });
        if (!selectionAnchorRef) setSelectionAnchorRef(ref);
      } else {
        setSelectedRefs(new Set([ref]));
        setSelectionAnchorRef(ref);
        if (onCopyCellRef) onCopyCellRef(ref);
      }
    },
    [editingCell, getCellRef, selectionAnchorRef, buildRangeBetween, onCopyCellRef]
  );

  const handleColumnHeaderClick = useCallback(
    (colIdx: number, letter: string, shiftKey: boolean) => {
      if (shiftKey && selectionAnchorRef) {
        const anchorMatch = selectionAnchorRef.match(/^([A-Z]+)(\d+)$/);
        if (anchorMatch) {
          const anchorLetter = anchorMatch[1];
          const anchorColIdx = sortedColumns.findIndex((c) => c.letter === anchorLetter);
          const minCol = Math.min(anchorColIdx, colIdx);
          const maxCol = Math.max(anchorColIdx, colIdx);
          const newRefs = new Set<string>();
          for (let ci = minCol; ci <= maxCol; ci++) {
            const col = sortedColumns[ci];
            for (const row of table.rows) {
              newRefs.add(`${col.letter}${row.rowIndex}`);
            }
          }
          setSelectedRefs(newRefs);
          return;
        }
      }

      const allRefsForCol = new Set<string>();
      for (const row of table.rows) {
        allRefsForCol.add(`${letter}${row.rowIndex}`);
      }
      setSelectedRefs(allRefsForCol);
      if (table.rows.length > 0) {
        const firstRow = [...table.rows].sort((a, b) => a.rowIndex - b.rowIndex)[0];
        setSelectionAnchorRef(`${letter}${firstRow.rowIndex}`);
      }
      setFocusedCell({ rowIndex: 0, colIndex: colIdx });
    },
    [table.rows, selectionAnchorRef, sortedColumns]
  );

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) return;
      if (!focusedCell) return;

      const { rowIndex, colIndex } = focusedCell;
      const numRows = table.rows.length;
      const numCols = sortedColumns.length;

      const move = (newRow: number, newCol: number) => {
        e.preventDefault();
        const row = table.rows[newRow];
        const col = sortedColumns[newCol];
        if (!row || !col) return;
        const ref = getCellRef(col, row.rowIndex);

        if (e.shiftKey && selectionAnchorRef) {
          const range = buildRangeBetween(selectionAnchorRef, ref);
          setSelectedRefs(range);
        } else {
          setSelectedRefs(new Set([ref]));
          setSelectionAnchorRef(ref);
        }
        setFocusedCell({ rowIndex: newRow, colIndex: newCol });
        scrollCellIntoView(newRow, newCol);
      };

      if (e.key === 'ArrowDown') move(Math.min(rowIndex + 1, numRows - 1), colIndex);
      else if (e.key === 'ArrowUp') move(Math.max(rowIndex - 1, 0), colIndex);
      else if (e.key === 'ArrowRight') move(rowIndex, Math.min(colIndex + 1, numCols - 1));
      else if (e.key === 'ArrowLeft') move(rowIndex, Math.max(colIndex - 1, 0));
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (colIndex > 0) move(rowIndex, colIndex - 1);
          else if (rowIndex > 0) move(rowIndex - 1, numCols - 1);
        } else {
          if (colIndex < numCols - 1) move(rowIndex, colIndex + 1);
          else if (rowIndex < numRows - 1) move(rowIndex + 1, 0);
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        const row = table.rows[rowIndex];
        const col = sortedColumns[colIndex];
        if (row && col) startEdit(row, col);
      } else if (e.key === 'Escape') {
        setSelectedRefs(new Set());
        setSelectionAnchorRef(null);
        setFocusedCell(null);
      }
    },
    [
      editingCell,
      focusedCell,
      table.rows,
      sortedColumns,
      startEdit,
      scrollCellIntoView,
      selectionAnchorRef,
      buildRangeBetween,
      getCellRef,
    ]
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
    await onEditFormula(editingFormulaCol!.id, headerName, expression);
    setEditingFormulaCol(null);
  };

  const closeAllMenus = useCallback(() => {
    setActiveColumnMenu(null);
  }, []);

  const isColumnFullySelected = useCallback(
    (letter: string) => {
      const colRefs = table.rows.map((r) => `${letter}${r.rowIndex}`);
      return colRefs.length > 0 && colRefs.every((r) => selectedRefs.has(r));
    },
    [selectedRefs, table.rows]
  );

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
        </div>
      </div>

      <div
        ref={tableContainerRef}
        className="overflow-auto flex-1 relative"
        onClick={closeAllMenus}
      >
        <table
          className="border-collapse text-xs"
          style={{
            tableLayout: 'fixed',
            minWidth: ROW_NUM_WIDTH + sortedColumns.length * COL_WIDTH,
            userSelect: 'none',
          }}
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
                  onMenuToggle={(id) =>
                    setActiveColumnMenu((prev) => (prev === id ? null : id))
                  }
                  onStartRename={(c) => {
                    setRenamingColId(c.id);
                    setRenamingValue(c.headerName);
                    setActiveColumnMenu(null);
                  }}
                  onEditFormula={(c) => {
                    setEditingFormulaCol(c);
                    setActiveColumnMenu(null);
                  }}
                  onDeleteColumn={(id) => {
                    onDeleteColumn(id);
                    setActiveColumnMenu(null);
                  }}
                  isColumnSelected={isColumnFullySelected(col.letter)}
                  onColumnHeaderClick={handleColumnHeaderClick}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={row.id} className="group hover:bg-blue-50/10 transition-colors">
                <td
                  className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 text-slate-400 text-center py-1.5 px-2 font-mono text-[10px] group-hover:bg-slate-100"
                  style={{ width: ROW_NUM_WIDTH }}
                >
                  {row.rowIndex}
                </td>
                {sortedColumns.map((col, colIdx) => {
                  const cellRef = getCellRef(col, row.rowIndex);
                  const isEditing =
                    editingCell?.rowId === row.id && editingCell?.columnId === col.id;
                  const isSaving = savingCell === `${row.id}-${col.id}`;
                  const isFocused =
                    focusedCell?.rowIndex === rowIdx && focusedCell?.colIndex === colIdx;
                  const isSelected = selectedRefs.has(cellRef);
                  const value = getCellValue(row, col);
                  const isFormula = col.type === 'formula';

                  return (
                    <td
                      key={col.id}
                      onDoubleClick={() => {
                        if (!isFormula) {
                          setSelectedRefs(new Set([cellRef]));
                          setSelectionAnchorRef(cellRef);
                          startEdit(row, col);
                        }
                      }}
                      onClick={(e) => handleCellClick(row, col, rowIdx, colIdx, e)}
                      title={isFormula ? undefined : `${cellRef}: ${row.cells[col.id] ?? ''}`}
                      style={{ width: COL_WIDTH }}
                      className={`
                        border-b border-r border-slate-200 relative h-8
                        ${isFormula ? 'cursor-default' : 'cursor-cell'}
                        ${isSaving ? 'opacity-50' : ''}
                        ${isSelected && !isEditing
                          ? isFormula
                            ? 'bg-blue-100/60'
                            : 'bg-blue-100'
                          : isFormula
                          ? 'bg-emerald-50/40 hover:bg-emerald-50'
                          : 'hover:bg-blue-50/40'
                        }
                        ${isFocused && !isEditing ? 'ring-2 ring-inset ring-blue-500' : ''}
                        transition-colors
                      `}
                    >
                      {isEditing ? (
                        <div className="flex items-center absolute inset-0 z-10 bg-white ring-2 ring-inset ring-blue-500">
                          <input
                            ref={cellInputRef}
                            autoFocus
                            value={editingCell.value}
                            onChange={(e) =>
                              setEditingCell((prev) =>
                                prev ? { ...prev, value: e.target.value } : null
                              )
                            }
                            onKeyDown={handleEditCellKeyDown}
                            onBlur={commitEdit}
                            className="flex-1 px-2 text-xs text-slate-800 bg-transparent outline-none font-mono min-w-0"
                          />
                          <div className="flex shrink-0">
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                commitEdit();
                              }}
                              className="p-1 hover:bg-emerald-100 text-emerald-600"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                cancelEdit();
                              }}
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

      <TableMathBar
        selectedRefs={selectedRefs}
        columns={table.columns}
        rows={table.rows}
        onSelectRange={setSelectedRefs}
      />

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
