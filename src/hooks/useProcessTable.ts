import { useState, useCallback, useEffect, useRef } from 'react';
import { useOfflineMutationGuard } from './useOfflineMutationGuard';
import type { ProcessTable, FormulaColumnDef, ParsedTableData, AggregateRow, AggregateOperation } from '../types/ProcessTable';
import {
  getProcessTable,
  importTable,
  updateCell,
  addFormulaColumn,
  updateFormulaColumn,
  deleteColumn,
  deleteProcessTable,
  updateTableName,
  renameColumn,
  addAggregateRow,
  updateAggregateRow,
  deleteAggregateRow,
} from '../services/tableImport.service';

interface UseProcessTableReturn {
  table: ProcessTable | null;
  loading: boolean;
  error: string | null;
  importing: boolean;
  importTableData: (parsed: ParsedTableData, tableName: string) => Promise<void>;
  editCell: (rowId: string, columnId: string, value: string | null) => Promise<void>;
  addFormula: (def: FormulaColumnDef) => Promise<void>;
  editFormula: (columnId: string, headerName: string, expression: string) => Promise<void>;
  renameColumnHeader: (columnId: string, headerName: string) => Promise<void>;
  removeColumn: (columnId: string) => Promise<void>;
  removeTable: () => Promise<void>;
  renameTable: (name: string) => Promise<void>;
  reload: () => Promise<void>;
  addAggregate: (columnId: string, operation: AggregateOperation, rangeStart: number | null, rangeEnd: number | null) => Promise<void>;
  editAggregate: (id: string, operation: AggregateOperation, rangeStart: number | null, rangeEnd: number | null) => Promise<void>;
  removeAggregate: (id: string) => Promise<void>;
}

export function useProcessTable(processId: string): UseProcessTableReturn {
  const [table, setTable] = useState<ProcessTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const tableRef = useRef<ProcessTable | null>(null);
  const { checkOnline } = useOfflineMutationGuard();

  const syncTableRef = (t: ProcessTable | null) => {
    tableRef.current = t;
    return t;
  };

  const load = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProcessTable(processId);
      setTable(syncTableRef(data));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    load();
  }, [load]);

  const importTableData = useCallback(
    async (parsed: ParsedTableData, tableName: string) => {
      if (!checkOnline()) return;
      setImporting(true);
      setError(null);
      try {
        const result = await importTable(processId, tableName, parsed);
        setTable(syncTableRef(result));
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setImporting(false);
      }
    },
    [processId, checkOnline]
  );

  const editCell = useCallback(
    async (rowId: string, columnId: string, value: string | null) => {
      if (!checkOnline()) return;
      let previousValue: string | null | undefined;
      setTable((prev) => {
        if (!prev) return prev;
        const row = prev.rows.find((r) => r.id === rowId);
        if (row) previousValue = row.cells[columnId];
        return {
          ...prev,
          rows: prev.rows.map((r) => {
            if (r.id !== rowId) return r;
            return { ...r, cells: { ...r.cells, [columnId]: value } };
          }),
        };
      });
      try {
        await updateCell(rowId, columnId, value);
      } catch (err) {
        setTable((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            rows: prev.rows.map((r) => {
              if (r.id !== rowId) return r;
              return { ...r, cells: { ...r.cells, [columnId]: previousValue ?? null } };
            }),
          };
        });
        throw err;
      }
    },
    [checkOnline]
  );

  const addFormula = useCallback(
    async (def: FormulaColumnDef) => {
      if (!checkOnline()) return;
      const current = tableRef.current;
      if (!current) return;
      const nextIndex = current.columns.reduce((max, c) => Math.max(max, c.index), -1) + 1;
      const newCol = await addFormulaColumn(current.id, nextIndex, def);
      setTable((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          columns: [...prev.columns, newCol],
          totalColumns: prev.totalColumns + 1,
        };
        tableRef.current = updated;
        return updated;
      });
    },
    [checkOnline]
  );

  const editFormula = useCallback(
    async (columnId: string, headerName: string, expression: string) => {
      if (!checkOnline()) return;
      await updateFormulaColumn(columnId, headerName, expression);
      setTable((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id !== columnId) return col;
            return { ...col, headerName, formulaExpression: expression };
          }),
        };
      });
    },
    [checkOnline]
  );

  const renameColumnHeader = useCallback(
    async (columnId: string, headerName: string) => {
      if (!checkOnline()) return;
      await renameColumn(columnId, headerName);
      setTable((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id !== columnId ? col : { ...col, headerName }
          ),
        };
      });
    },
    [checkOnline]
  );

  const removeColumn = useCallback(
    async (columnId: string) => {
      if (!checkOnline()) return;
      const current = tableRef.current;
      if (!current) return;
      await deleteColumn(columnId, current.id);
      setTable((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          columns: prev.columns.filter((c) => c.id !== columnId),
          totalColumns: prev.totalColumns - 1,
          aggregateRows: prev.aggregateRows.filter((a) => a.columnId !== columnId),
        };
        tableRef.current = updated;
        return updated;
      });
    },
    [checkOnline]
  );

  const removeTable = useCallback(async () => {
    if (!checkOnline()) return;
    const current = tableRef.current;
    if (!current) return;
    await deleteProcessTable(current.id);
    setTable(null);
    tableRef.current = null;
  }, [checkOnline]);

  const renameTable = useCallback(
    async (name: string) => {
      if (!checkOnline()) return;
      const current = tableRef.current;
      if (!current) return;
      await updateTableName(current.id, name);
      setTable((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, name };
        tableRef.current = updated;
        return updated;
      });
    },
    [checkOnline]
  );

  const addAggregate = useCallback(
    async (columnId: string, operation: AggregateOperation, rangeStart: number | null, rangeEnd: number | null) => {
      if (!checkOnline()) return;
      const current = tableRef.current;
      if (!current) return;
      const nextOrder = current.aggregateRows.length;
      const newAgg = await addAggregateRow(current.id, columnId, operation, rangeStart, rangeEnd, nextOrder);
      setTable((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, aggregateRows: [...prev.aggregateRows, newAgg] };
        tableRef.current = updated;
        return updated;
      });
    },
    [checkOnline]
  );

  const editAggregate = useCallback(
    async (id: string, operation: AggregateOperation, rangeStart: number | null, rangeEnd: number | null) => {
      if (!checkOnline()) return;
      await updateAggregateRow(id, operation, rangeStart, rangeEnd);
      setTable((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          aggregateRows: prev.aggregateRows.map((a) =>
            a.id !== id ? a : { ...a, operation, rangeStart, rangeEnd }
          ),
        };
      });
    },
    [checkOnline]
  );

  const removeAggregate = useCallback(async (id: string) => {
    if (!checkOnline()) return;
    await deleteAggregateRow(id);
    setTable((prev) => {
      if (!prev) return prev;
      return { ...prev, aggregateRows: prev.aggregateRows.filter((a) => a.id !== id) };
    });
  }, [checkOnline]);

  return {
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
    renameTable,
    reload: load,
    addAggregate,
    editAggregate,
    removeAggregate,
  };
}
