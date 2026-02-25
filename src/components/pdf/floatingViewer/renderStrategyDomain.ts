import type { FloatingViewerRenderStrategyDomain } from '../../../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: encapsular os sinais usados pela estratégia de renderização contínua/preload.
 * Limites: não decide janelas de render nem altera regras de orçamento.
 */
export const buildRenderStrategyDomain = (domain: FloatingViewerRenderStrategyDomain): FloatingViewerRenderStrategyDomain => domain;
