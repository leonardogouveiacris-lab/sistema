/**
 * Utilitários de validação centralizados
 * Funções reutilizáveis para validação de dados
 */

import { PROCESS_CONSTANTS } from '../types/Process';
import { DECISION_CONSTANTS } from '../types/Decision';
import { VERBA_CONSTANTS } from '../types/Verba';
import type { NewVerbaComLancamento } from '../types/Verba';

/**
 * Interface para resultados de validação
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Classe de validações otimizada com caching
 */
class ValidationUtils {
  // Cache de regex para performance
  private static readonly REGEX_CACHE = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    numeroProcesso: /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/,
    whitespace: /^\s*$/
  } as const;

  /**
   * Valida se um campo é obrigatório e não está vazio
   */
  static isRequired(value: unknown, fieldName: string): string | null {
    if (value === null || value === undefined || 
        (typeof value === 'string' && this.REGEX_CACHE.whitespace.test(value))) {
      return `${fieldName} é obrigatório`;
    }
    return null;
  }

  /**
   * Valida comprimento mínimo de string
   */
  static minLength(value: string, min: number, fieldName: string): string | null {
    if (value.length < min) {
      return `${fieldName} deve ter pelo menos ${min} caracteres`;
    }
    return null;
  }

  /**
   * Valida comprimento máximo de string
   */
  static maxLength(value: string, max: number, fieldName: string): string | null {
    if (value.length > max) {
      return `${fieldName} deve ter no máximo ${max} caracteres`;
    }
    return null;
  }

  /**
   * Valida dados de um novo processo
   */
  static validateNewProcess(data: any): ValidationResult {
    const errors: Record<string, string> = {};

    // Validação do número do processo
    const numeroError = this.isRequired(data.numeroProcesso, 'Número do processo');
    if (numeroError) {
      errors.numeroProcesso = numeroError;
    } else if (data.numeroProcesso.length < PROCESS_CONSTANTS.MIN_NUMERO_LENGTH) {
      errors.numeroProcesso = `Número deve ter pelo menos ${PROCESS_CONSTANTS.MIN_NUMERO_LENGTH} caracteres`;
    }

    // Validação do reclamante
    const reclamanteError = this.isRequired(data.reclamante, 'Reclamante');
    if (reclamanteError) {
      errors.reclamante = reclamanteError;
    }

    // Validação da reclamada
    const reclamadaError = this.isRequired(data.reclamada, 'Reclamada');
    if (reclamadaError) {
      errors.reclamada = reclamadaError;
    }

    // Validação das observações (opcional, mas com limite)
    if (data.observacoesGerais && data.observacoesGerais.length > PROCESS_CONSTANTS.MAX_OBSERVACOES_LENGTH) {
      errors.observacoesGerais = `Observações devem ter no máximo ${PROCESS_CONSTANTS.MAX_OBSERVACOES_LENGTH} caracteres`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida dados de uma nova decisão
   */
  static validateNewDecision(data: any): ValidationResult {
    const errors: Record<string, string> = {};

    // Validação do tipo de decisão
    const tipoError = this.isRequired(data.tipoDecisao, 'Tipo de decisão');
    if (tipoError) {
      errors.tipoDecisao = tipoError;
    }

    // Validação do ID da decisão
    const idError = this.isRequired(data.idDecisao, 'ID da decisão');
    if (idError) {
      errors.idDecisao = idError;
    } else if (data.idDecisao.length < DECISION_CONSTANTS.MIN_ID_LENGTH) {
      errors.idDecisao = `ID deve ter pelo menos ${DECISION_CONSTANTS.MIN_ID_LENGTH} caracteres`;
    }

    // Validação da situação
    const situacaoError = this.isRequired(data.situacao, 'Situação');
    if (situacaoError) {
      errors.situacao = situacaoError;
    }

    // Validação do processo vinculado
    const processIdError = this.isRequired(data.processId, 'Processo vinculado');
    if (processIdError) {
      errors.processId = processIdError;
    }

    // Validação das observações (opcional, mas com limite)
    if (data.observacoes && data.observacoes.length > DECISION_CONSTANTS.MAX_OBSERVACOES_LENGTH) {
      errors.observacoes = `Observações devem ter no máximo ${DECISION_CONSTANTS.MAX_OBSERVACOES_LENGTH} caracteres`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida dados de uma nova verba com lançamento (estrutura hierárquica)
   */
  static validateNewVerbaComLancamento(data: NewVerbaComLancamento): ValidationResult {
    const errors: Record<string, string> = {};

    // Validação do tipo de verba
    const tipoError = this.isRequired(data.tipoVerba, 'Tipo de verba');
    if (tipoError) {
      errors.tipoVerba = tipoError;
    } else if (data.tipoVerba.length < VERBA_CONSTANTS.MIN_TIPO_LENGTH) {
      errors.tipoVerba = `Tipo deve ter pelo menos ${VERBA_CONSTANTS.MIN_TIPO_LENGTH} caracteres`;
    }

    // Validação da decisão vinculada
    const decisaoError = this.isRequired(data.lancamento.decisaoVinculada, 'Decisão vinculada');
    if (decisaoError) {
      errors.decisaoVinculada = decisaoError;
    }

    // Validação da situação
    const situacaoError = this.isRequired(data.lancamento.situacao, 'Situação');
    if (situacaoError) {
      errors.situacao = situacaoError;
    }

    // Validação do processo vinculado
    const processIdError = this.isRequired(data.processId, 'Processo vinculado');
    if (processIdError) {
      errors.processId = processIdError;
    }

    // Validação da fundamentação (opcional, mas com limite)
    if (data.lancamento.fundamentacao && data.lancamento.fundamentacao.length > VERBA_CONSTANTS.MAX_FUNDAMENTACAO_LENGTH) {
      errors.fundamentacao = `Fundamentação deve ter no máximo ${VERBA_CONSTANTS.MAX_FUNDAMENTACAO_LENGTH} caracteres`;
    }

    // Validação dos comentários (opcional, mas com limite)
    if (data.lancamento.comentariosCalculistas && data.lancamento.comentariosCalculistas.length > VERBA_CONSTANTS.MAX_COMENTARIOS_LENGTH) {
      errors.comentariosCalculistas = `Comentários devem ter no máximo ${VERBA_CONSTANTS.MAX_COMENTARIOS_LENGTH} caracteres`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida dados de uma nova verba (compatibilidade com versão anterior)
   * @deprecated Use validateNewVerbaComLancamento para nova estrutura hierárquica
   */
  static validateNewVerba(data: any): ValidationResult {
    // Converte dados antigos para nova estrutura
    const newStructureData: NewVerbaComLancamento = {
      tipoVerba: data.tipoVerba,
      processId: data.processId,
      lancamento: {
        decisaoVinculada: data.decisaoVinculada,
        situacao: data.situacao,
        fundamentacao: data.fundamentacao,
        comentariosCalculistas: data.comentariosCalculistas
      }
    };

    const result = this.validateNewVerbaComLancamento(newStructureData);
    
    // Mapeia os erros de volta para os nomes antigos dos campos
    const mappedErrors: Record<string, string> = {};
    Object.entries(result.errors).forEach(([key, value]) => {
      mappedErrors[key] = value;
    });

    return { isValid: result.isValid, errors: mappedErrors };
  }
}

export default ValidationUtils;