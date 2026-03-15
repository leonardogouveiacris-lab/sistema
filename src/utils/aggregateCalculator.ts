import type { AggregateOperation, AggregateRow, ProcessTableColumn, ProcessTableRow } from '../types/ProcessTable';
import { normalizeNumberString } from './numberUtils';

export const OPERATION_LABELS: Record<AggregateOperation, string> = {
  sum: 'SOMA',
  average: 'MÉDIA',
  min: 'MÍN',
  max: 'MÁX',
  count: 'CONTAGEM',
  product: 'PRODUTO',
  median: 'MEDIANA',
  stddev: 'DESVPAD',
};

export const OPERATION_DESCRIPTIONS: Record<AggregateOperation, string> = {
  sum: 'Soma todos os valores da coluna',
  average: 'Calcula a média aritmética',
  min: 'Retorna o menor valor',
  max: 'Retorna o maior valor',
  count: 'Conta quantos valores existem',
  product: 'Multiplica todos os valores',
  median: 'Calcula a mediana (valor central)',
  stddev: 'Desvio padrão amostral',
};

function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const str = String(value).replace(/[^\d.,-]/g, '').trim();
  const normalized = normalizeNumberString(str);
  const n = parseFloat(normalized.replace(/\s/g, ''));
  return isNaN(n) ? null : n;
}

function extractValues(
  columnId: string,
  rows: ProcessTableRow[],
  rangeStart: number | null,
  rangeEnd: number | null
): number[] {
  const filtered = rows.filter((row) => {
    if (rangeStart !== null && row.rowIndex < rangeStart) return false;
    if (rangeEnd !== null && row.rowIndex > rangeEnd) return false;
    return true;
  });

  const values: number[] = [];
  for (const row of filtered) {
    const n = parseNumber(row.cells[columnId]);
    if (n !== null) values.push(n);
  }
  return values;
}

export function computeAggregate(
  agg: AggregateRow,
  rows: ProcessTableRow[]
): number | null {
  const values = extractValues(agg.columnId, rows, agg.rangeStart, agg.rangeEnd);
  if (values.length === 0) return null;

  switch (agg.operation) {
    case 'sum':
      return values.reduce((acc, v) => acc + v, 0);

    case 'average':
      return values.reduce((acc, v) => acc + v, 0) / values.length;

    case 'min':
      return Math.min(...values);

    case 'max':
      return Math.max(...values);

    case 'count':
      return values.length;

    case 'product':
      return values.reduce((acc, v) => acc * v, 1);

    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    case 'stddev': {
      if (values.length < 2) return 0;
      const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
      const variance =
        values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
      return Math.sqrt(variance);
    }

    default:
      return null;
  }
}

export function formatAggregateResult(value: number | null, operation: AggregateOperation): string {
  if (value === null) return '—';
  if (operation === 'count') return String(Math.round(value));
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getColumnsForAggregate(columns: ProcessTableColumn[]): ProcessTableColumn[] {
  return columns.filter((c) => c.type === 'data');
}
