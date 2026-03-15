export interface ProcessTableRecord {
  id: string;
  process_id: string;
  name: string;
  total_rows: number;
  total_columns: number;
  created_at: string;
  updated_at: string;
}

export type ProcessTableColumnType = 'data' | 'formula';

export interface ProcessTableColumnRecord {
  id: string;
  table_id: string;
  column_letter: string;
  column_index: number;
  header_name: string;
  column_type: ProcessTableColumnType;
  formula_expression?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessTableRowRecord {
  id: string;
  table_id: string;
  row_index: number;
  created_at: string;
}

export interface ProcessTableCellRecord {
  id: string;
  row_id: string;
  column_id: string;
  cell_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessTableRow {
  id: string;
  rowIndex: number;
  cells: Record<string, string | null>;
}

export interface ProcessTableColumn {
  id: string;
  letter: string;
  index: number;
  headerName: string;
  type: ProcessTableColumnType;
  formulaExpression?: string | null;
}

export interface ParsedTableData {
  headers: string[];
  rows: (string | null)[][];
}

export interface FormulaColumnDef {
  headerName: string;
  expression: string;
}

export type AggregateOperation = 'sum' | 'average' | 'min' | 'max' | 'count' | 'product' | 'median' | 'stddev';

export interface AggregateRowRecord {
  id: string;
  table_id: string;
  column_id: string;
  operation: AggregateOperation;
  range_start: number | null;
  range_end: number | null;
  display_order: number;
  created_at: string;
}

export interface AggregateRow {
  id: string;
  tableId: string;
  columnId: string;
  operation: AggregateOperation;
  rangeStart: number | null;
  rangeEnd: number | null;
  displayOrder: number;
}

export interface ProcessTable {
  id: string;
  processId: string;
  name: string;
  totalRows: number;
  totalColumns: number;
  columns: ProcessTableColumn[];
  rows: ProcessTableRow[];
  aggregateRows: AggregateRow[];
  createdAt: string;
  updatedAt: string;
}
