/**
 * Barrel export para todos os componentes
 * Centraliza exports para facilitar imports
 */

// Componentes principais
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as Header } from './Header';
export { default as Navigation } from './Navigation';
export { default as ProcessForm } from './ProcessForm';
export { default as ProcessList } from './ProcessList';
export { default as ProcessDetails } from './ProcessDetails';
export { default as DecisionForm } from './DecisionForm';
export { default as DecisionList } from './DecisionList';
export { default as DecisionEditModal } from './DecisionEditModal';
export { default as AllDecisionsList } from './AllDecisionsList';
export { default as ProcessVerbaList } from './ProcessVerbaList';
export { default as ProcessDocumentoList } from './ProcessDocumentoList';
export { default as VerbaForm } from './VerbaForm';
export { default as VerbaList } from './VerbaList';
export { default as VerbaEditModal } from './VerbaEditModal';
export { default as VerbaChecklistProgress } from './VerbaChecklistProgress';
export { default as RelatorioVerbas } from './RelatorioVerbas';
export { default as DocumentoLancamentoCard } from './DocumentoLancamentoCard';
export { default as TipoVerbaManagementModal } from './ui/TipoVerbaManagementModal';

// Re-export componentes UI
export * from './ui';