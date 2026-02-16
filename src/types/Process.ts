/**
 * Tipos otimizados para o sistema de processos
 * Utiliza tipos base para consistência e reutilização
 */

import { BaseEntity, BaseFilter } from './Common';

/**
 * Status das verbas no processo
 */
export type StatusVerbas = 'pendente' | 'em_andamento' | 'concluido';

/**
 * Interface principal para processos
 * Herda campos de auditoria da BaseEntity
 */
export interface Process extends BaseEntity {
  numeroProcesso: string;        // Número oficial do processo (único)
  reclamante: string;           // Nome da parte autora
  reclamada: string;            // Nome da parte ré
  observacoesGerais?: string;   // Observações adicionais (opcional)
  statusVerbas: StatusVerbas;   // Status geral das verbas do processo
}

/**
 * Tipo para criação de novos processos
 * Omite campos gerados automaticamente pelo sistema
 */
export type NewProcess = Omit<Process, keyof BaseEntity | 'statusVerbas'>;

/**
 * Interface para filtros de busca de processos
 * Herda estrutura base de filtros
 */
export interface ProcessFilter extends BaseFilter {
  // Filtros específicos podem ser adicionados aqui no futuro
}

/**
 * Constantes relacionadas a processos
 */
export const PROCESS_CONSTANTS = {
  MIN_NUMERO_LENGTH: 5,
  MAX_OBSERVACOES_LENGTH: 1000
} as const;