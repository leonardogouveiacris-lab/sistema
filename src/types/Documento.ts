/**
 * Tipos para o sistema de lançamento de documentos
 * Estrutura similar ao sistema de decisões e verbas
 */

import { BaseEntity, BaseFilter } from './Common';

/**
 * Opções pré-definidas para tipos de documento
 * Readonly array para imutabilidade
 */
export const TIPOS_DOCUMENTO_PREDEFINIDOS = [
  'Contrato de Trabalho',
  'CTPS',
  'Holerite',
  'Rescisão',
  'Recibos',
  'Termo de Ajuste de Conduta',
  'Procuração',
  'Atestado Médico',
  'Laudo Pericial',
  'Acordo',
  'Petição Inicial',
  'Contestação',
  'RR',
  'AIRR',
  'Outros Documentos'
] as const;

/**
 * Tipos derivados das constantes para type safety
 */
export type TipoDocumento = typeof TIPOS_DOCUMENTO_PREDEFINIDOS[number];

/**
 * Interface principal para lançamentos de documentos
 * Herda campos de auditoria da BaseEntity
 */
export interface Documento extends BaseEntity {
  tipoDocumento: string;        // Tipo do documento (ex: Contrato de Trabalho)
  comentarios?: string;         // Comentários sobre o documento (opcional)
  processId: string;            // ID do processo vinculado (obrigatório)
  paginaVinculada?: number;     // Página do PDF onde o documento está vinculado (opcional)
  processDocumentId?: string;   // ID do documento PDF específico onde o documento foi registrado (opcional)
  highlightIds?: string[];      // Array de IDs de highlights PDF vinculados (múltiplas seleções)
}

/**
 * Tipo para criação de novos documentos
 * Omite campos gerados automaticamente pelo sistema
 */
export type NewDocumento = Omit<Documento, keyof BaseEntity>;

/**
 * Interface para filtros de busca de documentos
 * Herda estrutura base e adiciona filtros específicos
 */
export interface DocumentoFilter extends BaseFilter {
  tipoDocumento?: string;       // Filtro por tipo (opcional)
  processId?: string;           // Filtro por processo (opcional)
  hasPaginaVinculada?: boolean; // Filtro por documentos com página vinculada (opcional)
}

/**
 * Constantes relacionadas a documentos
 */
export const DOCUMENTO_CONSTANTS = {
  MIN_TIPO_LENGTH: 3,
  MAX_COMENTARIOS_LENGTH: 5000
} as const;
