import type { ProcessTableColumn, ProcessTableRow } from '../types/ProcessTable';
import { normalizeNumberString } from './numberUtils';

export interface SelectionStats {
  sum: number;
  average: number;
  count: number;
  min: number;
  max: number;
  hasValues: boolean;
}

function parseCellToNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const str = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!str) return null;
  const normalized = normalizeNumberString(str);
  const n = parseFloat(normalized.replace(/\s/g, ''));
  return isNaN(n) ? null : n;
}

export function computeSelectionStats(
  selectedRefs: Set<string>,
  columns: ProcessTableColumn[],
  rows: ProcessTableRow[]
): SelectionStats {
  const colByLetter: Record<string, ProcessTableColumn> = {};
  for (const col of columns) {
    colByLetter[col.letter] = col;
  }

  const rowByIndex: Record<number, ProcessTableRow> = {};
  for (const row of rows) {
    rowByIndex[row.rowIndex] = row;
  }

  const values: number[] = [];

  for (const ref of selectedRefs) {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    const letter = match[1];
    const rowIdx = parseInt(match[2], 10);

    const col = colByLetter[letter];
    const row = rowByIndex[rowIdx];
    if (!col || !row) continue;

    const rawValue = row.cells[col.id];
    const num = parseCellToNumber(rawValue);
    if (num !== null) values.push(num);
  }

  if (values.length === 0) {
    return { sum: 0, average: 0, count: 0, min: 0, max: 0, hasValues: false };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const average = sum / values.length;
  const min = values.reduce((a, b) => (b < a ? b : a), values[0]);
  const max = values.reduce((a, b) => (b > a ? b : a), values[0]);

  return { sum, average, count: values.length, min, max, hasValues: true };
}

export function formatStatNumber(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function describeSelection(selectedRefs: Set<string>): string {
  if (selectedRefs.size === 0) return '';

  const refs = Array.from(selectedRefs);

  const byColumn: Record<string, number[]> = {};
  for (const ref of refs) {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    const letter = match[1];
    const rowIdx = parseInt(match[2], 10);
    if (!byColumn[letter]) byColumn[letter] = [];
    byColumn[letter].push(rowIdx);
  }

  const letters = Object.keys(byColumn).sort();

  if (letters.length === 1) {
    const letter = letters[0];
    const indices = byColumn[letter].sort((a, b) => a - b);
    const isContiguous = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
    if (isContiguous && indices.length > 1) {
      return `${letter}${indices[0]}:${letter}${indices[indices.length - 1]}`;
    }
    if (indices.length === 1) return `${letter}${indices[0]}`;
    return indices.map((i) => `${letter}${i}`).join(', ');
  }

  if (letters.length <= 3) {
    return letters
      .map((letter) => {
        const indices = byColumn[letter].sort((a, b) => a - b);
        const isContiguous = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
        if (isContiguous && indices.length > 1) {
          return `${letter}${indices[0]}:${letter}${indices[indices.length - 1]}`;
        }
        return indices.map((i) => `${letter}${i}`).join(', ');
      })
      .join('; ');
  }

  return `${refs.length} células`;
}
