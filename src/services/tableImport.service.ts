import { supabase } from '../lib/supabase';
import { columnIndexToLetter } from '../utils/tableParser';
import type {
  ProcessTable,
  ProcessTableColumn,
  ProcessTableRow,
  ProcessTableRecord,
  ProcessTableColumnRecord,
  ProcessTableRowRecord,
  ProcessTableCellRecord,
  ParsedTableData,
  FormulaColumnDef,
} from '../types/ProcessTable';

function mapColumnRecord(r: ProcessTableColumnRecord): ProcessTableColumn {
  return {
    id: r.id,
    letter: r.column_letter,
    index: r.column_index,
    headerName: r.header_name,
    type: r.column_type,
    formulaExpression: r.formula_expression,
  };
}

function buildTable(
  record: ProcessTableRecord,
  columns: ProcessTableColumn[],
  rows: ProcessTableRow[]
): ProcessTable {
  return {
    id: record.id,
    processId: record.process_id,
    name: record.name,
    totalRows: record.total_rows,
    totalColumns: record.total_columns,
    columns,
    rows,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function getProcessTable(processId: string): Promise<ProcessTable | null> {
  if (!supabase) return null;

  const { data: tableRecord, error: tableError } = await supabase
    .from('process_tables')
    .select('*')
    .eq('process_id', processId)
    .maybeSingle();

  if (tableError) throw tableError;
  if (!tableRecord) return null;

  const { data: colRecords, error: colError } = await supabase
    .from('process_table_columns')
    .select('*')
    .eq('table_id', tableRecord.id)
    .order('column_index', { ascending: true });

  if (colError) throw colError;

  const columns: ProcessTableColumn[] = (colRecords as ProcessTableColumnRecord[]).map(mapColumnRecord);

  const { data: rowRecords, error: rowError } = await supabase
    .from('process_table_rows')
    .select('*')
    .eq('table_id', tableRecord.id)
    .order('row_index', { ascending: true });

  if (rowError) throw rowError;

  const rowIds = (rowRecords as ProcessTableRowRecord[]).map((r) => r.id);

  let cells: ProcessTableCellRecord[] = [];
  if (rowIds.length > 0) {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data: cellData, error: cellError } = await supabase
        .from('process_table_cells')
        .select('*')
        .in('row_id', rowIds)
        .range(from, from + PAGE_SIZE - 1);

      if (cellError) throw cellError;
      const page = cellData as ProcessTableCellRecord[];
      cells = cells.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  const cellsByRow: Record<string, ProcessTableCellRecord[]> = {};
  for (const cell of cells) {
    if (!cellsByRow[cell.row_id]) cellsByRow[cell.row_id] = [];
    cellsByRow[cell.row_id].push(cell);
  }

  const rows: ProcessTableRow[] = (rowRecords as ProcessTableRowRecord[])
    .map((rowRecord) => {
      const rowCells = cellsByRow[rowRecord.id] ?? [];
      const cellMap: Record<string, string | null> = {};
      for (const cell of rowCells) {
        cellMap[cell.column_id] = cell.cell_value;
      }
      return {
        id: rowRecord.id,
        rowIndex: rowRecord.row_index,
        cells: cellMap,
      };
    })
    .filter((row) => Object.values(row.cells).some((v) => v !== null && v !== ''));

  const reindexedRows = rows.map((row, i) => ({ ...row, rowIndex: i + 1 }));

  return buildTable(tableRecord as ProcessTableRecord, columns, reindexedRows);
}

export async function importTable(
  processId: string,
  tableName: string,
  parsed: ParsedTableData
): Promise<ProcessTable> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: existing } = await supabase
    .from('process_tables')
    .select('id')
    .eq('process_id', processId)
    .maybeSingle();

  if (existing) {
    await deleteProcessTable(existing.id);
  }

  const { data: tableRecord, error: tableError } = await supabase
    .from('process_tables')
    .insert({
      process_id: processId,
      name: tableName,
      total_rows: parsed.rows.length,
      total_columns: parsed.headers.length,
    })
    .select()
    .single();

  if (tableError) throw tableError;

  const columnInserts = parsed.headers.map((header, index) => ({
    table_id: tableRecord.id,
    column_letter: columnIndexToLetter(index),
    column_index: index,
    header_name: header,
    column_type: 'data' as const,
  }));

  const { data: colRecords, error: colError } = await supabase
    .from('process_table_columns')
    .insert(columnInserts)
    .select();

  if (colError) throw colError;

  const columns: ProcessTableColumn[] = (colRecords as ProcessTableColumnRecord[]).map(mapColumnRecord);

  const columnIdByIndex: Record<number, string> = {};
  for (const col of columns) {
    columnIdByIndex[col.index] = col.id;
  }

  const BATCH_SIZE = 100;
  const rows: ProcessTableRow[] = [];

  for (let i = 0; i < parsed.rows.length; i += BATCH_SIZE) {
    const batch = parsed.rows.slice(i, i + BATCH_SIZE);
    const rowInserts = batch.map((_, batchIdx) => ({
      table_id: tableRecord.id,
      row_index: i + batchIdx + 1,
    }));

    const { data: rowRecords, error: rowError } = await supabase
      .from('process_table_rows')
      .insert(rowInserts)
      .select();

    if (rowError) throw rowError;

    const cellInserts: { row_id: string; column_id: string; cell_value: string | null }[] = [];
    const insertedRows = rowRecords as ProcessTableRowRecord[];

    for (let batchIdx = 0; batchIdx < insertedRows.length; batchIdx++) {
      const rowRecord = insertedRows[batchIdx];
      const dataRow = parsed.rows[i + batchIdx];
      const cellMap: Record<string, string | null> = {};

      for (let c = 0; c < dataRow.length; c++) {
        const colId = columnIdByIndex[c];
        if (colId) {
          cellMap[colId] = dataRow[c];
          cellInserts.push({
            row_id: rowRecord.id,
            column_id: colId,
            cell_value: dataRow[c],
          });
        }
      }

      rows.push({
        id: rowRecord.id,
        rowIndex: rowRecord.row_index,
        cells: cellMap,
      });
    }

    if (cellInserts.length > 0) {
      const { error: cellError } = await supabase
        .from('process_table_cells')
        .insert(cellInserts);
      if (cellError) throw cellError;
    }
  }

  return buildTable(tableRecord as ProcessTableRecord, columns, rows);
}

export async function updateCell(
  rowId: string,
  columnId: string,
  value: string | null
): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: existing } = await supabase
    .from('process_table_cells')
    .select('id')
    .eq('row_id', rowId)
    .eq('column_id', columnId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('process_table_cells')
      .update({ cell_value: value })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('process_table_cells')
      .insert({ row_id: rowId, column_id: columnId, cell_value: value });
    if (error) throw error;
  }
}

export async function addFormulaColumn(
  tableId: string,
  nextIndex: number,
  def: FormulaColumnDef
): Promise<ProcessTableColumn> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: colRecord, error } = await supabase
    .from('process_table_columns')
    .insert({
      table_id: tableId,
      column_letter: columnIndexToLetter(nextIndex),
      column_index: nextIndex,
      header_name: def.headerName,
      column_type: 'formula' as const,
      formula_expression: def.expression,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('process_tables')
    .update({ total_columns: nextIndex + 1 })
    .eq('id', tableId);

  return mapColumnRecord(colRecord as ProcessTableColumnRecord);
}

export async function updateFormulaColumn(
  columnId: string,
  headerName: string,
  expression: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('process_table_columns')
    .update({ header_name: headerName, formula_expression: expression })
    .eq('id', columnId);

  if (error) throw error;
}

export async function renameColumn(columnId: string, headerName: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('process_table_columns')
    .update({ header_name: headerName })
    .eq('id', columnId);

  if (error) throw error;
}

export async function deleteColumn(columnId: string, tableId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('process_table_columns')
    .delete()
    .eq('id', columnId);

  if (error) throw error;

  const { data: remaining } = await supabase
    .from('process_table_columns')
    .select('id')
    .eq('table_id', tableId);

  await supabase
    .from('process_tables')
    .update({ total_columns: remaining?.length ?? 0 })
    .eq('id', tableId);
}

export async function deleteProcessTable(tableId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('process_tables')
    .delete()
    .eq('id', tableId);

  if (error) throw error;
}

export async function updateTableName(tableId: string, name: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('process_tables')
    .update({ name })
    .eq('id', tableId);

  if (error) throw error;
}
