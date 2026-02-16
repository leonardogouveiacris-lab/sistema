/**
 * Constantes centralizadas do sistema
 * 
 * Este arquivo centraliza todas as constantes utilizadas no sistema
 * para facilitar manutenção e evitar valores hardcoded espalhados pelo código
 */

// Versão do sistema para controle
export const SYSTEM_VERSION = '1.0.0';

// Informações da aplicação
export const APP_INFO = {
  NAME: 'Sistema de Liquidacao',
  DESCRIPTION: 'Gestao de Processos e Relatorios',
  AUTHOR: 'CalculoPro',
  CONTACT: 'contato@calculopro.com.br'
} as const;

// Configurações de UI
export const UI_CONFIG = {
  DEBOUNCE_DELAY: 300,           // Delay para operações com debounce (ms)
  ANIMATION_DURATION: 200,       // Duração padrão das animações (ms)
  MAX_FILE_SIZE: 5 * 1024 * 1024, // Tamanho máximo de arquivo (5MB)
  ITEMS_PER_PAGE: 10,            // Itens por página em listas paginadas
  SEARCH_MIN_LENGTH: 2           // Mínimo de caracteres para busca
} as const;

// Configurações de highlights PDF
export const HIGHLIGHT_CONFIG = {
  FUNDAMENTACAO_COLOR: 'blue' as const,  // Cor fixa para highlights de fundamentação
  SELECTION_BORDER_WIDTH: 4,              // Largura da borda para highlight selecionado
  SELECTION_ANIMATION_DURATION: 5000,     // Duração da animação de seleção (ms)
  SCROLL_BEHAVIOR: 'smooth' as const      // Comportamento do scroll ao navegar
} as const;

// Configurações de validação
export const VALIDATION_CONFIG = {
  MIN_PROCESS_NUMBER_LENGTH: 5,
  MAX_OBSERVACOES_LENGTH: 1000,
  MIN_DECISION_ID_LENGTH: 3,
  MAX_DECISION_OBSERVACOES_LENGTH: 500,
  MIN_VERBA_TYPE_LENGTH: 3,
  MAX_FUNDAMENTACAO_LENGTH: 5000,
  MAX_COMENTARIOS_LENGTH: 5000
} as const;

// Mensagens de erro padrão
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: (field: string) => `${field} é obrigatório`,
  MIN_LENGTH: (field: string, length: number) => `${field} deve ter pelo menos ${length} caracteres`,
  MAX_LENGTH: (field: string, length: number) => `${field} deve ter no máximo ${length} caracteres`,
  INVALID_FORMAT: (field: string) => `${field} está em formato inválido`,
  ALREADY_EXISTS: (item: string) => `${item} já existe`,
  NOT_FOUND: (item: string) => `${item} não encontrado`,
  SAVE_ERROR: 'Erro ao salvar dados',
  LOAD_ERROR: 'Erro ao carregar dados',
  DELETE_ERROR: 'Erro ao excluir dados',
  EXPORT_ERROR: 'Erro ao exportar dados',
  IMPORT_ERROR: 'Erro ao importar dados'
} as const;

// Mensagens de sucesso padrão
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: (item: string) => `${item} salvo com sucesso`,
  DELETE_SUCCESS: (item: string) => `${item} excluído com sucesso`,
  UPDATE_SUCCESS: (item: string) => `${item} atualizado com sucesso`,
  EXPORT_SUCCESS: (item: string) => `${item} exportado com sucesso`,
  IMPORT_SUCCESS: (item: string) => `${item} importado com sucesso`
} as const;

// Configurações de exportação HTML
export const EXPORT_CONFIG = {
  HTML_TEMPLATE_VERSION: '1.0',
  DEFAULT_FILENAME_PREFIX: 'relatorio-liquidacao',
  DATE_FORMAT_OPTIONS: {
    year: 'numeric' as const,
    month: 'long' as const,
    day: 'numeric' as const,
    hour: '2-digit' as const,
    minute: '2-digit' as const
  },
  PDF_MARGINS: {
    top: '2cm',
    right: '2cm',
    bottom: '2cm',
    left: '2cm'
  }
} as const;

// Configurações de rede
export const NETWORK_CONFIG = {
  REQUEST_TIMEOUT: 30000,        // Timeout padrão para requisições (ms)
  RETRY_ATTEMPTS: 3,             // Número de tentativas em caso de erro
  RETRY_DELAY: 1000             // Delay entre tentativas (ms)
} as const;

// Temas de cor
export const THEME_COLORS = {
  PRIMARY: {
    50: '#eff6ff',
    100: '#dbeafe', 
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8'
  },
  SUCCESS: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d'
  },
  ERROR: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c'
  },
  WARNING: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309'
  }
} as const;