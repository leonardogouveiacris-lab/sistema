import type { FloatingViewerToolbarVisualDomain } from '../../../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: expor controles visuais da toolbar (pickers, overflow e ações).
 * Limites: não calcula layout responsivo nem decide permissões de negócio.
 */
export const buildToolbarVisualDomain = (domain: FloatingViewerToolbarVisualDomain): FloatingViewerToolbarVisualDomain => domain;
