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

// Tipo para operações de CRUD
export interface CRUDOperations<T, U> {
  items: T[];
  add: (item: U) => void;
  update: (id: string, data: Partial<U>) => void;
  remove: (id: string) => void;
  getById: (id: string) => T | undefined;
}

// Enum para estados de loading
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

// Interface para callbacks de navegação
export interface NavigationCallbacks {
  onSelectProcess?: (process: any) => void;
  onBackToList?: () => void;
}