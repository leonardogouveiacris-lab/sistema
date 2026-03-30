/**
 * Barrel export para hooks personalizados
 * Centraliza exports para facilitar imports
 */

export { useProcesses } from './useProcesses';
export { useDynamicEnums } from './useDynamicEnums';
export { useTipoVerbas } from './useTipoVerbas';
export { useProcessDocuments } from './useProcessDocuments';
export { useDocumentoLancamentos } from './useDocumentoLancamentos';
export { useDebounce } from './useDebounce';
export { useDebouncedCallback } from './useDebouncedCallback';
export { useBackToTop } from './useBackToTop';
export { useRealtimeSubscription } from './useRealtimeSubscription';
export { useResponsivePanel } from './useResponsivePanel';
export { useSelectionOverlay } from './useSelectionOverlay';
export { usePdfNavigationState } from './usePdfNavigationState';
export { usePdfRenderBudget } from './usePdfRenderBudget';
export { usePdfBookmarks } from './usePdfBookmarks';
export type { SelectionRect, SelectionOverlayResult } from './useSelectionOverlay';

export { useDecisionContext as useDecisions } from '../contexts/DecisionContext';
export { useVerbaContext as useVerbas } from '../contexts/VerbaContext';
export { useDocumentoContext as useDocumentos } from '../contexts/DocumentoContext';

export type { OperationResult } from '../types/Common';
export { useLancamentosForReference } from './useLancamentosForReference';
export { useDraggablePanel } from './useDraggablePanel';
export { useNavigateToReference } from './useNavigateToReference';
export type { LancamentoReferenceItem, LancamentoRefType } from './useLancamentosForReference';