import * as XLSX from 'xlsx';
import type { ProcessTable } from '../types/ProcessTable';
import { evaluateFormula } from './formulaEvaluator';

export function exportTableSpreadsheet(table: ProcessTable): void {
  const sortedColumns = [...table.columns].sort((a, b) => a.index - b.index);

  const headerRow = sortedColumns.map((col) => col.headerName);

  const dataRows = table.rows.map((row) =>
    sortedColumns.map((col) => {
      if (col.type === 'formula' && col.formulaExpression) {
        const result = evaluateFormula(col.formulaExpression, sortedColumns, row);
        return result ?? '';
      }
      return row.cells[col.id] ?? '';
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  ws['!cols'] = sortedColumns.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, table.name.slice(0, 31));

  const safeName = table.name.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}
