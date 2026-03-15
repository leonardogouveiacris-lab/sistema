import * as XLSX from 'xlsx';
import type { ParsedTableData } from '../types/ProcessTable';

export function columnIndexToLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export function letterToColumnIndex(letter: string): number {
  const upper = letter.toUpperCase();
  let result = 0;
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '0';
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return String(value);
    return '0';
  }
  return String(value);
}

export async function parseXlsxFile(file: File): Promise<ParsedTableData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: false,
        });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        const headerRow = jsonData[0] as unknown[];
        const headers = headerRow.map((h) => cellToString(h) ?? '');
        const maxCols = headers.length;

        const rows: (string | null)[][] = [];
        for (let r = 1; r < jsonData.length; r++) {
          const rawRow = jsonData[r] as unknown[];
          const hasData = rawRow.some((v) => v !== null && v !== undefined && v !== '');
          if (!hasData) continue;
          const row: (string | null)[] = [];
          for (let c = 0; c < maxCols; c++) {
            row.push(cellToString(rawRow[c] ?? null));
          }
          rows.push(row);
        }

        resolve({ headers, rows });
      } catch (err) {
        reject(new Error('Falha ao processar o arquivo Excel: ' + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseCsvFile(file: File): Promise<ParsedTableData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string;
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: false,
        });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        const headerRow = jsonData[0] as unknown[];
        const headers = headerRow.map((h) => cellToString(h) ?? '');
        const maxCols = headers.length;

        const rows: (string | null)[][] = [];
        for (let r = 1; r < jsonData.length; r++) {
          const rawRow = jsonData[r] as unknown[];
          const hasData = rawRow.some((v) => v !== null && v !== undefined && v !== '');
          if (!hasData) continue;
          const row: (string | null)[] = [];
          for (let c = 0; c < maxCols; c++) {
            row.push(cellToString(rawRow[c] ?? null));
          }
          rows.push(row);
        }

        resolve({ headers, rows });
      } catch (err) {
        reject(new Error('Falha ao processar o arquivo CSV: ' + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

export async function parseTableFile(file: File): Promise<ParsedTableData> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseCsvFile(file);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsxFile(file);
  }
  throw new Error('Formato de arquivo não suportado. Use .xlsx, .xls ou .csv');
}
