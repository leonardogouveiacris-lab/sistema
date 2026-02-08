/**
 * Tipos otimizados para o sistema de decisões judiciais
 * Estrutura melhorada com constantes e validações
 */

import { BaseEntity, BaseFilter } from './Common';

/**
 * Opções pré-definidas para tipos de decisão
 * Readonly array para imutabilidade
 */
export const TIPOS_DECISAO_PREDEFINIDOS = [
  'Sentença',
  'Acórdão', 
  'Despacho',
  'Decisão Interlocutória',
  'Decisão Monocrática',
  'Embargos de Declaração'
] as const;

/**
 * Opções pré-definidas para situações das decisões
 * Readonly array para imutabilidade
 */
export const SITUACOES_DECISAO_PREDEFINIDAS = [
  'Procedente',
  'Improcedente',
  'Parcialmente Procedente', 
  'Extinto sem Julgamento do Mérito',
  'Homologado',
  'Rejeitado',
  'Deferido',
  'Indeferido'
] as const;

/**
 * Tipos derivados das constantes para type safety
 */
export type TipoDecisao = typeof TIPOS_DECISAO_PREDEFINIDOS[number];
export type SituacaoDecisao = typeof SITUACOES_DECISAO_PREDEFINIDAS[number];

/**
 * Interface principal para decisões judiciais
 * Herda campos de auditoria da BaseEntity
 */
export interface Decision extends BaseEntity {
  tipoDecisao: string;          // Tipo da decisão (ex: Sentença)
  idDecisao: string;            // Código/ID da decisão (ex: SEN-001)
  situacao: string;             // Situação da decisão (ex: Procedente)
  observacoes?: string;         // Observações adicionais (opcional)
  processId: string;            // ID do processo vinculado (obrigatório)
  paginaVinculada?: number;     // Página do PDF onde a decisão está vinculada (opcional)
  processDocumentId?: string;   // ID do documento PDF específico onde a decisão foi registrada (opcional)
}

/**
 * Tipo para criação de novas decisões
 * Omite campos gerados automaticamente pelo sistema
 */
export type NewDecision = Omit<Decision, keyof BaseEntity>;

/**
 * Interface para filtros de busca de decisões
 * Herda estrutura base e adiciona filtros específicos
 */
export interface DecisionFilter extends BaseFilter {
  tipoDecisao?: string;        // Filtro por tipo (opcional)
  situacao?: string;           // Filtro por situação (opcional)
  processId?: string;          // Filtro por processo (opcional)
}

/**
 * Constantes relacionadas a decisões
 */
export const DECISION_CONSTANTS = {
  MIN_ID_LENGTH: 3,
  MAX_OBSERVACOES_LENGTH: 500
} as const;