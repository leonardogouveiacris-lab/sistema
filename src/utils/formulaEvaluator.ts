import type { ProcessTableColumn, ProcessTableRow } from '../types/ProcessTable';
import { normalizeNumberString } from './numberUtils';

const TOKEN_REGEX = /([A-Z]+)\b/g;

function parseNumber(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(/[^\d.,-]/g, '').trim();
  const normalized = normalizeNumberString(str);
  const n = parseFloat(normalized.replace(/\s/g, ''));
  return isNaN(n) ? 0 : n;
}

function buildLetterMap(
  columns: ProcessTableColumn[],
  row: ProcessTableRow
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const col of columns) {
    if (col.type === 'data') {
      const rawValue = row.cells[col.id];
      map[col.letter] = parseNumber(rawValue);
    }
  }
  return map;
}

function substituteLetters(
  expression: string,
  letterMap: Record<string, number>
): string {
  const allLetters = Object.keys(letterMap).sort((a, b) => b.length - a.length);

  let result = expression.toUpperCase();

  for (const letter of allLetters) {
    const regex = new RegExp(`\\b${letter}\\b`, 'g');
    result = result.replace(regex, String(letterMap[letter]));
  }

  return result;
}

function safeEval(expression: string): number {
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
  if (!/\S/.test(sanitized)) return 0;

  try {
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const result = fn();
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return result;
  } catch {
    return 0;
  }
}

export function evaluateFormula(
  expression: string,
  columns: ProcessTableColumn[],
  row: ProcessTableRow
): string {
  if (!expression || !expression.trim()) return '';

  const letterMap = buildLetterMap(columns, row);
  const substituted = substituteLetters(expression, letterMap);
  const result = safeEval(substituted);

  const rounded = Math.round(result * 1000000) / 1000000;
  return String(rounded);
}

export function extractFormulaLetters(expression: string): string[] {
  const matches = expression.toUpperCase().match(TOKEN_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
}

export function validateFormulaExpression(
  expression: string,
  availableLetters: string[]
): { valid: boolean; error?: string } {
  if (!expression.trim()) {
    return { valid: false, error: 'A expressão não pode estar vazia' };
  }

  const sanitized = expression.toUpperCase();
  const usedLetters = extractFormulaLetters(sanitized);

  for (const letter of usedLetters) {
    if (!availableLetters.includes(letter)) {
      return {
        valid: false,
        error: `Coluna "${letter}" não existe na tabela`,
      };
    }
  }

  const mockMap: Record<string, number> = {};
  for (const letter of availableLetters) {
    mockMap[letter] = 1;
  }

  const substituted = substituteLetters(sanitized, mockMap);
  const testSanitized = substituted.replace(/[^0-9+\-*/().\s]/g, '');

  try {
    const fn = new Function(`"use strict"; return (${testSanitized});`);
    const result = fn();
    if (typeof result !== 'number') {
      return { valid: false, error: 'Expressão inválida' };
    }
  } catch {
    return { valid: false, error: 'Expressão com sintaxe inválida' };
  }

  return { valid: true };
}

export function formatFormulaResult(value: string): string {
  const n = parseFloat(value);
  if (isNaN(n)) return value;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCellNumber(value: string | null): string {
  if (value === null || value === '') return '';
  const str = String(value).trim();
  if (!/^-?[\d.,\s]+$/.test(str)) return str;

  const normalized = normalizeNumberString(str);
  const n = parseFloat(normalized.replace(/\s/g, ''));
  if (isNaN(n)) return str;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
