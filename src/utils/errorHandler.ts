/**
 * Utilitário centralizado para tratamento de erros
 * 
 * Este arquivo fornece funções padronizadas para tratamento de erros
 * em toda a aplicação, incluindo logging, notificações e recuperação
 */

import logger from './logger';
import { ERROR_MESSAGES } from '../constants';

/**
 * Tipos de erro categorizados para melhor tratamento
 */
export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  STORAGE = 'storage',
  BUSINESS = 'business',
  SYSTEM = 'system',
  USER = 'user'
}

/**
 * Interface para erros estruturados
 */
export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: unknown;
  timestamp: Date;
  context?: string;
}

/**
 * Classe personalizada para erros da aplicação
 */
export class SystemError extends Error {
  public readonly type: ErrorType;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly timestamp: Date;
  public readonly context?: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.SYSTEM,
    code?: string,
    details?: unknown,
    context?: string
  ) {
    super(message);
    this.name = 'SystemError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
  }
}

/**
 * Tratador principal de erros
 * 
 * Centraliza o tratamento de todos os erros da aplicação
 * fornecendo logging consistente e recuperação quando possível
 * 
 * @param error - Erro a ser tratado
 * @param context - Contexto onde o erro ocorreu
 * @returns Objeto com informações do erro tratado
 */
export const handleError = (
  error: unknown,
  context: string = 'Unknown'
): { success: false; message: string; canRetry: boolean } => {
  let errorMessage: string;
  let canRetry = false;
  let errorType = ErrorType.SYSTEM;

  // Determina o tipo de erro e mensagem apropriada
  if (error instanceof SystemError) {
    errorMessage = error.message;
    errorType = error.type;
    canRetry = error.type === ErrorType.NETWORK;
    
    logger.error(
      `SystemError in ${context}: ${error.message}`,
      context,
      {
        type: error.type,
        code: error.code,
        details: error.details
      },
      error
    );
  } else if (error instanceof Error) {
    errorMessage = error.message;
    
    // Identifica tipos específicos de erro por mensagem
    if (error.message.includes('fetch') || error.message.includes('network')) {
      errorType = ErrorType.NETWORK;
      canRetry = true;
    } else if (error.message.includes('localStorage') || error.message.includes('quota')) {
      errorType = ErrorType.STORAGE;
    } else if (error.message.includes('validation') || error.message.includes('required')) {
      errorType = ErrorType.VALIDATION;
    }

    logger.errorWithException(
      `Unhandled error in ${context}`,
      error,
      context,
      { errorType }
    );
  } else {
    errorMessage = String(error) || ERROR_MESSAGES.SAVE_ERROR;
    
    logger.warn(
      `Unknown error type in ${context}: ${errorMessage}`,
      context,
      { error }
    );
  }

  return {
    success: false,
    message: errorMessage,
    canRetry
  };
};

/**
 * Wrapper para operações assíncronas com tratamento de erro
 * 
 * Executa uma operação assíncrona com tratamento automático de erro
 * e retry opcional para erros de rede
 * 
 * @param operation - Função assíncrona a ser executada
 * @param context - Contexto da operação
 * @param retryCount - Número de tentativas (padrão: 0)
 * @returns Resultado da operação ou erro tratado
 */
export const safeAsyncOperation = async <T>(
  operation: () => Promise<T>,
  context: string,
  retryCount: number = 0
): Promise<{ success: true; data: T } | { success: false; message: string; canRetry: boolean }> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorResult = handleError(error, context);
    
    // Retry automático para erros de rede
    if (errorResult.canRetry && retryCount > 0) {
      logger.info(
        `Retrying operation in ${context}, attempts remaining: ${retryCount}`,
        context
      );
      
      // Delay progressivo entre tentativas
      await new Promise(resolve => setTimeout(resolve, (4 - retryCount) * 1000));
      
      return safeAsyncOperation(operation, context, retryCount - 1);
    }
    
    return errorResult;
  }
};

/**
 * Wrapper para operações síncronas com tratamento de erro
 * 
 * Executa uma operação síncrona com tratamento automático de erro
 * 
 * @param operation - Função síncrona a ser executada
 * @param context - Contexto da operação
 * @returns Resultado da operação ou erro tratado
 */
export const safeSyncOperation = <T>(
  operation: () => T,
  context: string
): { success: true; data: T } | { success: false; message: string; canRetry: boolean } => {
  try {
    const data = operation();
    return { success: true, data };
  } catch (error) {
    return handleError(error, context);
  }
};

/**
 * Valida se um erro pode ser recuperado automaticamente
 * 
 * @param error - Erro a ser analisado
 * @returns true se o erro é recuperável
 */
export const isRecoverableError = (error: unknown): boolean => {
  if (error instanceof SystemError) {
    return error.type === ErrorType.NETWORK || error.type === ErrorType.STORAGE;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('fetch') || 
           message.includes('timeout') ||
           message.includes('quota');
  }
  
  return false;
};

const SUPABASE_ERROR_MAP: Record<string, string> = {
  'verbas_tipo_verba_check': 'O tipo de verba informado é inválido.',
  'violates check constraint': 'Os dados informados violam uma restrição do sistema.',
  'violates foreign key constraint': 'Registro relacionado não encontrado.',
  'duplicate key value': 'Este registro já existe no sistema.',
  'null value in column': 'Campo obrigatório não preenchido.',
  'invalid input syntax': 'Formato de dados inválido.',
  'value too long': 'O texto informado excede o limite permitido.',
  'permission denied': 'Você não tem permissão para realizar esta operação.',
  'row-level security': 'Acesso negado. Verifique suas permissões.',
  'JWT expired': 'Sua sessão expirou. Recarregue a página.',
  'connection refused': 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  'timeout': 'A operação demorou muito. Tente novamente.',
  'PGRST': 'Erro ao comunicar com o banco de dados.',
};

export const translateSupabaseError = (message: string): string => {
  if (!message) return 'Ocorreu um erro inesperado. Tente novamente.';

  const lowerMessage = message.toLowerCase();

  for (const [key, translation] of Object.entries(SUPABASE_ERROR_MAP)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return translation;
    }
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }

  if (lowerMessage.includes('error') && message.length > 100) {
    return 'Ocorreu um erro ao processar sua solicitação. Tente novamente.';
  }

  return message;
};

/**
 * Cria uma mensagem de erro amigável para o usuário
 *
 * @param error - Erro a ser convertido
 * @returns Mensagem amigável para exibir ao usuário
 */
export const getUserFriendlyMessage = (error: unknown): string => {
  if (error instanceof SystemError) {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Erro de conexão. Verifique sua internet e tente novamente.';
      case ErrorType.STORAGE:
        return 'Erro de armazenamento. Verifique o espaço disponível.';
      case ErrorType.VALIDATION:
        return error.message; // Mensagens de validação já são amigáveis
      case ErrorType.BUSINESS:
        return error.message; // Regras de negócio já são amigáveis
      default:
        return 'Ocorreu um erro inesperado. Tente novamente.';
    }
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    if (message.includes('quota') || message.includes('storage')) {
      return 'Erro de armazenamento. Verifique o espaço disponível.';
    }
  }
  
  return 'Ocorreu um erro inesperado. Tente novamente.';
};

export default {
  handleError,
  safeAsyncOperation,
  safeSyncOperation,
  isRecoverableError,
  getUserFriendlyMessage,
  translateSupabaseError,
  SystemError,
  ErrorType
};
