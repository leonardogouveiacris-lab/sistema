import type { FloatingViewerNavigationDomain } from '../../../types/FloatingPDFViewerContracts';

/**
 * Responsabilidade: montar contrato de navegação/paginação para componentes de UI.
 * Limites: não aplica side-effects de scroll nem lê contexto global diretamente.
 */
export const buildNavigationPaginationDomain = (domain: FloatingViewerNavigationDomain): FloatingViewerNavigationDomain => domain;
