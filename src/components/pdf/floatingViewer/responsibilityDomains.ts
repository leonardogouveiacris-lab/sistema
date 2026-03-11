/**
 * Mapa de responsabilidades do FloatingPDFViewer por domínio funcional.
 * Usado para orientar extrações incrementais sem misturar regras entre áreas.
 */
export const FLOATING_VIEWER_RESPONSIBILITY_DOMAINS = {
  navigationPagination: [
    'estado de página atual/input de navegação',
    'commit de mudança de página e regras de prioridade',
    'sincronização com navegação manual/teclado/pesquisa'
  ],
  bookmarks: [
    'extração de índices por documento',
    'cache local e status de carregamento/falha',
    'agregação de bookmarks para navegação unificada'
  ],
  overlaysComments: [
    'popup de seleção de texto',
    'camadas de highlights/comentários',
    'modais de rotação e extração de páginas'
  ],
  pageRotation: [
    'controle de rotação por página/faixa',
    'aplicação visual da rotação no render',
    'sincronização com estado do contexto de PDF'
  ],
  scrollSelectionSync: [
    'detecção de páginas visíveis por scroll/observer',
    'reconciliação via RAF + timeouts de segurança',
    'proteções durante seleção de texto e scroll programático'
  ]
} as const;
