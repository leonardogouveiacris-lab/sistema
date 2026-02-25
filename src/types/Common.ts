/**
 * Tipos comuns compartilhados entre diferentes módulos do sistema
 * Centraliza definições básicas para evitar duplicação
 */

// Tipo genérico para filtros de busca
export interface BaseFilter {
  searchTerm: string;
}

// Tipo genérico para entidades com auditoria
export interface BaseEntity {
  id: string;
  dataCriacao: Date;
  dataAtualizacao: Date;
}

// Enum para estados de loading
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}