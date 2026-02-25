import type { FloatingViewerSelectionCommentsDomain } from '../../../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: concentrar toggles visuais e ações de seleção/highlight/comentários.
 * Limites: não renderiza overlays nem persiste comentários/destaques.
 */
export const buildSelectionCommentsDomain = (domain: FloatingViewerSelectionCommentsDomain): FloatingViewerSelectionCommentsDomain => domain;
