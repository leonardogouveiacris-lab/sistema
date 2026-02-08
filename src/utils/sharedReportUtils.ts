/**
 * Shared utility functions for report generation
 * Consolidates duplicate logic to improve maintainability and reduce bundle size
 */

import { VerbaLancamento } from '../types/Verba';

/**
 * Situation-to-badge color mapping for consistent styling across the application
 * Centralized to avoid duplication between reportUtils and htmlFormatter
 */
const SITUACAO_COLOR_MAP: Record<string, string> = {
  'Deferida': 'bg-green-100 text-green-800 border-green-200',
  'Procedente': 'bg-green-100 text-green-800 border-green-200',
  'Deferido': 'bg-green-100 text-green-800 border-green-200',
  'Homologado': 'bg-green-100 text-green-800 border-green-200',
  'Indeferida': 'bg-red-100 text-red-800 border-red-200',
  'Excluída': 'bg-red-100 text-red-800 border-red-200',
  'Improcedente': 'bg-red-100 text-red-800 border-red-200',
  'Indeferido': 'bg-red-100 text-red-800 border-red-200',
  'Rejeitado': 'bg-red-100 text-red-800 border-red-200',
  'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Reformada': 'bg-blue-100 text-blue-800 border-blue-200',
  'Em Análise': 'bg-purple-100 text-purple-800 border-purple-200',
  'Aguardando Documentação': 'bg-purple-100 text-purple-800 border-purple-200',
  'Extinto sem Julgamento do Mérito': 'bg-gray-100 text-gray-800 border-gray-200'
};

const DEFAULT_BADGE_COLOR = 'bg-gray-100 text-gray-800 border-gray-200';

/**
 * Gets badge color classes for a given situation
 * Unified function used across the application
 */
export function getBadgeColor(situacao: string): string {
  return SITUACAO_COLOR_MAP[situacao] || DEFAULT_BADGE_COLOR;
}

/**
 * Cached date formatter for Brazilian locale
 * Reuses Intl.DateTimeFormat instance for better performance
 */
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(includeTime: boolean): Intl.DateTimeFormat {
  const key = includeTime ? 'with-time' : 'without-time';

  if (!dateFormatterCache.has(key)) {
    const options: Intl.DateTimeFormatOptions = includeTime
      ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };

    dateFormatterCache.set(key, new Intl.DateTimeFormat('pt-BR', options));
  }

  return dateFormatterCache.get(key)!;
}

/**
 * Formats date in Brazilian format with time
 * Optimized with cached formatter
 */
export function formatarData(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Data não disponível';
  }
  return getDateFormatter(true).format(date);
}

/**
 * Formats date in Brazilian format without time
 * Optimized with cached formatter
 */
export function formatarDataCurta(date: Date): string {
  return getDateFormatter(false).format(date);
}

/**
 * Calculates summary of situations from lancamentos
 * Unified function to avoid duplication
 */
export function calcularResumoSituacoes(lancamentos: VerbaLancamento[]): Record<string, number> {
  const resumo: Record<string, number> = {};

  for (const lanc of lancamentos) {
    const situacao = lanc.situacao || 'Não especificada';
    resumo[situacao] = (resumo[situacao] || 0) + 1;
  }

  return resumo;
}

/**
 * Formats situation summary for display
 * Converts object to readable string
 */
export function formatarResumoSituacoes(resumo: Record<string, number>): string {
  return Object.entries(resumo)
    .sort(([, a], [, b]) => b - a)
    .map(([situacao, count]) => {
      const situacaoLower = situacao.toLowerCase();
      const plural = count > 1 ? 's' : '';
      return `${count} ${situacaoLower}${plural}`;
    })
    .join(', ');
}

/**
 * Checks if lancamentos have multiple different situations
 * Optimized by creating Set directly
 */
export function hasMudancaSituacao(lancamentos: VerbaLancamento[]): boolean {
  if (lancamentos.length < 2) return false;

  const firstSituacao = lancamentos[0].situacao;
  for (let i = 1; i < lancamentos.length; i++) {
    if (lancamentos[i].situacao !== firstSituacao) return true;
  }

  return false;
}

/**
 * Removes HTML tags from string using regex (faster than DOM manipulation)
 * Optimized for better performance
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Extracts preview text from HTML
 * Optimized with slice instead of substring
 */
export function getPreviewText(html: string | undefined, maxLength: number = 150): string {
  if (!html) return '';
  const text = stripHtml(html);
  return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
}

/**
 * Filters items by process ID
 */
export function filtrarPorProcesso<T extends { processId: string }>(
  items: T[],
  processId: string
): T[] {
  return items.filter(item => item.processId === processId);
}
