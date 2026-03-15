import { useState, useCallback, useEffect } from 'react';
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

  const load = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProcessTable(processId);
      setTable(data);
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
      setImporting(true);
      setError(null);
      try {
        const result = await importTable(processId, tableName, parsed);
        setTable(result);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setImporting(false);
      }
    },
    [processId]
  );

  const editCell = useCallback(
    async (rowId: string, columnId: string, value: string | null) => {
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
    []
  );

  const addFormula = useCallback(
    async (def: FormulaColumnDef) => {
      if (!table) return;
      const nextIndex = table.columns.reduce((max, c) => Math.max(max, c.index), -1) + 1;
      const newCol = await addFormulaColumn(table.id, nextIndex, def);
      setTable((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: [...prev.columns, newCol],
          totalColumns: prev.totalColumns + 1,
        };
      });
    },
    [table]
  );

  const editFormula = useCallback(
    async (columnId: string, headerName: string, expression: string) => {
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
    []
  );

  const renameColumnHeader = useCallback(
    async (columnId: string, headerName: string) => {
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
    []
  );

  const removeColumn = useCallback(
    async (columnId: string) => {
      if (!table) return;
      await deleteColumn(columnId, table.id);
      setTable((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.filter((c) => c.id !== columnId),
          totalColumns: prev.totalColumns - 1,
          aggregateRows: prev.aggregateRows.filter((a) => a.columnId !== columnId),
        };
      });
    },
    [table]
  );

  const removeTable = useCallback(async () => {
    if (!table) return;
    await deleteProcessTable(table.id);
    setTable(null);
  }, [table]);

  const renameTable = useCallback(
    async (name: string) => {
      if (!table) return;
      await updateTableName(table.id, name);
      setTable((prev) => (prev ? { ...prev, name } : prev));
    },
    [table]
  );

  const addAggregate = useCallback(
    async (columnId: string, operation: AggregateOperation, rangeStart: number | null, rangeEnd: number | null) => {
      if (!table) return;
      const nextOrder = table.aggregateRows.length;
      const newAgg = await addAggregateRow(table.id, columnId, operation, rangeStart, rangeEnd, nextOrder);
      setTable((prev) => {
        if (!prev) return prev;
        return { ...prev, aggregateRows: [...prev.aggregateRows, newAgg] };
      });
    },
    [table]
  );

  const editAggregate = useCallback(
    async (id: string, operation: AggregateOperation, rangeStart: number | null, rangeEnd: number | null) => {
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
    []
  );

  const removeAggregate = useCallback(async (id: string) => {
    await deleteAggregateRow(id);
    setTable((prev) => {
      if (!prev) return prev;
      return { ...prev, aggregateRows: prev.aggregateRows.filter((a) => a.id !== id) };
    });
  }, []);

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
