import { useState, useCallback, useEffect } from 'react';
import type { ProcessTable, FormulaColumnDef, ParsedTableData } from '../types/ProcessTable';
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
  };
}
