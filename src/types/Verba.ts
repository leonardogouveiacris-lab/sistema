/**
 * Tipos otimizados para o sistema de verbas trabalhistas com estrutura hierárquica
 * Estrutura: Verba > Lançamentos (Decisões)
 */

import { BaseEntity, BaseFilter } from './Common';

/**
 * Opções pré-definidas para situações das verbas
 * Readonly array para imutabilidade
 */
export const SITUACOES_VERBA_PREDEFINIDAS = [
  'Deferida',
  'Indeferida',
  'Parcialmente Deferida',
  'Reformada',
  'Excluída',
  'Em Análise',
  'Aguardando Documentação',
  'Improcedente'
] as const;

/**
 * Tipos derivados das constantes para type safety
 */
export type SituacaoVerba = typeof SITUACOES_VERBA_PREDEFINIDAS[number];

/**
 * Interface para lançamentos individuais da verba
 * Cada lançamento representa uma decisão específica sobre a verba
 */
export interface VerbaLancamento extends BaseEntity {
  decisaoVinculada: string;      // ID da decisão vinculada (ex: "sentença", "acórdão")
  situacao: string;              // Situação da verba nesta decisão (ex: "Deferida", "Reformada")
  fundamentacao?: string;        // Fundamentação jurídica específica (rich text)
  comentariosCalculistas?: string; // Comentários dos calculistas específicos (rich text)
  verbaId: string;              // ID da verba pai à qual este lançamento pertence
  paginaVinculada?: number;     // Página do PDF onde o lançamento está vinculado (opcional)
  processDocumentId?: string;   // ID do documento PDF específico onde o lançamento foi registrado (opcional)
  highlightId?: string;         // ID do highlight PDF vinculado à fundamentação (deprecated, use highlightIds)
  highlightIds?: string[];      // Array de IDs de highlights PDF vinculados (múltiplas seleções)
  checkCalculista: boolean;     // Indica se o cálculo foi concluído
  checkCalculistaAt?: Date;     // Data/hora em que o check do calculista foi marcado
  checkRevisor: boolean;        // Indica se a revisão foi aprovada
  checkRevisorAt?: Date;        // Data/hora em que o check do revisor foi marcado
}

/**
 * Interface principal para verbas trabalhistas com estrutura hierárquica
 * Uma verba pode ter múltiplos lançamentos (decisões)
 */
export interface Verba extends BaseEntity {
  tipoVerba: string;             // Tipo da verba (ex: "Danos Morais", "Horas Extras")
  processId: string;             // ID do processo vinculado (obrigatório)
  lancamentos: VerbaLancamento[]; // Array de lançamentos/decisões desta verba
}

/**
 * Tipo para criação de novos lançamentos de verba
 * Omite campos gerados automaticamente pelo sistema
 */
export type NewVerbaLancamento = Omit<VerbaLancamento, keyof BaseEntity | 'verbaId'>;

/**
 * Tipo para criação de novas verbas
 * Omite campos gerados automaticamente pelo sistema
 */
export type NewVerba = Omit<Verba, keyof BaseEntity | 'lancamentos'>;

/**
 * Tipo para criação de lançamento em verba existente ou nova
 * Inclui o tipo da verba para identificação/criação
 */
export type NewVerbaComLancamento = {
  tipoVerba: string;
  processId: string;
  lancamento: NewVerbaLancamento;
};

/**
 * Status do checklist de lançamentos
 */
export type ChecklistStatus = 'pendente' | 'aguardando_revisao' | 'concluido';

/**
 * Interface para filtros de busca de verbas
 * Herda estrutura base e adiciona filtros específicos
 */
export interface VerbaFilter extends BaseFilter {
  tipoVerba?: string;           // Filtro por tipo (opcional)
  situacao?: string;            // Filtro por situação (opcional)
  processId?: string;           // Filtro por processo (opcional)
  decisaoVinculada?: string;    // Filtro por decisão (opcional)
  checklistStatus?: ChecklistStatus; // Filtro por status do checklist (opcional)
}

/**
 * Interface para estatísticas do checklist
 */
export interface ChecklistStats {
  total: number;                // Total de lançamentos
  pendentes: number;            // Sem nenhum check
  aguardandoRevisao: number;    // Apenas calculista marcado
  concluidos: number;           // Ambos checks marcados
  percentualConcluido: number;  // Percentual de conclusão (0-100)
}

/**
 * Constantes relacionadas a verbas
 */
export const VERBA_CONSTANTS = {
  MIN_TIPO_LENGTH: 2,
  MAX_TIPO_LENGTH: 100,
  MAX_FUNDAMENTACAO_LENGTH: 5000,
  MAX_COMENTARIOS_LENGTH: 5000,
} as const;