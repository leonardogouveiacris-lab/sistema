import type { FloatingViewerBookmarksDomain } from '../../../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: agrupar dependências de gestão de bookmarks (estado, indicadores e ações).
 * Limites: não define estratégia de extração/cache; apenas expõe contrato para orquestração.
 */
export const buildBookmarksDomain = (domain: FloatingViewerBookmarksDomain): FloatingViewerBookmarksDomain => domain;
