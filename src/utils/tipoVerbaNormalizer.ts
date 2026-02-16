/**
 * Utilitário especializado para normalização de tipos de verba
 * 
 * Este arquivo centraliza todas as operações de normalização e formatação
 * de nomes de tipos de verba, garantindo consistência em todo o sistema.
 * 
 * Responsabilidades:
 * - Aplicar padrão Title Case (primeira letra de cada palavra maiúscula)
 * - Validar formato dos nomes de tipos
 * - Limpar caracteres inválidos
 * - Normalizar espaçamento e pontuação
 * - Fornecer feedback de validação detalhado
 * 
 * Separado em arquivo próprio para:
 * - Reutilização em diferentes partes do sistema
 * - Facilitar testes unitários
 * - Manter lógica de normalização centralizada
 * - Seguir princípio de responsabilidade única
 */

import { VERBA_CONSTANTS } from '../types/Verba';
import { logger } from './index';

/**
 * Interface para resultado de validação de tipo
 * Fornece informações detalhadas sobre a validação
 */
export interface TipoValidationResult {
  isValid: boolean;           // Se o tipo é válido
  errorMessage?: string;      // Mensagem de erro específica (se inválido)
  normalizedValue: string;    // Valor normalizado (sempre retornado)
  suggestions?: string[];     // Sugestões de correção (opcional)
}

/**
 * Classe utilitária para normalização de tipos de verba
 * 
 * Todas as funções são estáticas para facilitar o uso em qualquer
 * parte do sistema sem necessidade de instanciação
 */
export class TipoVerbaNormalizer {

  /**
   * Palavras que devem manter capitalização específica
   * Arrays separados para diferentes categorias de palavras especiais
   */
  private static readonly SPECIAL_WORDS = {
    // Siglas que devem ficar em maiúsculo
    acronyms: ['FGTS', 'PIS', 'PASEP', 'INSS', 'IRRF', 'GPS', 'TST', 'CLT', 'OJ'],
    
    // Preposições que devem ficar em minúsculo (exceto no início)
    prepositions: ['de', 'do', 'da', 'dos', 'das', 'em', 'na', 'no', 'nas', 'nos', 'por', 'para'],
    
    // Números ordinais e percentuais comuns
    numerics: ['1/3', '2/3', '13º', '1º', '2º', '3º', '40%', '50%', '60%', '100%']
  };

  /**
   * Normaliza um tipo de verba para o padrão Title Case com regras específicas
   * 
   * Aplica as seguintes transformações:
   * 1. Remove espaços extras no início e fim
   * 2. Converte para Title Case (primeira letra maiúscula)
   * 3. Aplica regras especiais para siglas e preposições
   * 4. Preserva números ordinais e percentuais
   * 5. Corrige espaçamento entre palavras
   * 
   * @param input - Texto de entrada a ser normalizado
   * @returns Texto normalizado seguindo padrões do sistema
   */
  static normalize(input: string): string {
    try {
      logger.info(
        `Normalizando tipo de verba: "${input}"`,
        'TipoVerbaNormalizer.normalize',
        { originalInput: input, inputLength: input.length }
      );

      // Etapa 1: Limpeza inicial
      let normalized = input
        .trim()                           // Remove espaços no início e fim
        .replace(/\s+/g, ' ')            // Substitui múltiplos espaços por um único
        .replace(/\s*-\s*/g, '-')        // Normaliza hífens (remove espaços ao redor)
        .replace(/\s*\.\s*/g, '. ');      // Normaliza pontos com espaço após

      // Etapa 2: Aplica Title Case com regras especiais
      const words = normalized.toLowerCase().split(' ');
      
      const normalizedWords = words.map((word, index) => {
        // Se palavra está vazia, pula
        if (!word) return word;
        
        // Verifica se é sigla (deve ficar em maiúsculo)
        const upperWord = word.toUpperCase();
        if (this.SPECIAL_WORDS.acronyms.includes(upperWord)) {
          return upperWord;
        }
        
        // Verifica se é número/ordinal/percentual (preserva formato)
        if (this.SPECIAL_WORDS.numerics.some(num => word.includes(num.toLowerCase()))) {
          return this.SPECIAL_WORDS.numerics.find(num => 
            word.includes(num.toLowerCase())
          ) || this.capitalizeFirst(word);
        }
        
        // Verifica se é preposição (minúsculo, exceto primeira palavra)
        if (index > 0 && this.SPECIAL_WORDS.prepositions.includes(word)) {
          return word.toLowerCase();
        }
        
        // Aplica Title Case normal
        return this.capitalizeFirst(word);
      });

      // Etapa 3: Junta as palavras normalizadas
      normalized = normalizedWords.join(' ');

      // Etapa 4: Correções finais específicas
      normalized = this.applySpecificCorrections(normalized);

      logger.success(
        `Tipo normalizado: "${input}" → "${normalized}"`,
        'TipoVerbaNormalizer.normalize',
        { 
          originalInput: input, 
          normalizedOutput: normalized,
          wordsProcessed: normalizedWords.length
        }
      );

      return normalized;

    } catch (error) {
      logger.errorWithException(
        `Erro na normalização do tipo: "${input}"`,
        error as Error,
        'TipoVerbaNormalizer.normalize',
        { originalInput: input }
      );

      // Em caso de erro, retorna pelo menos Title Case básico
      return this.basicTitleCase(input);
    }
  }

  /**
   * Aplica correções específicas conhecidas do domínio jurídico
   *
   * Trata casos especiais comuns que precisam
   * de formatação específica para ficarem corretos
   * 
   * @param text - Texto já processado pelas regras gerais
   * @returns Texto com correções específicas aplicadas
   */
  private static applySpecificCorrections(text: string): string {
    // Mapeamento de correções específicas conhecidas
    const corrections: Record<string, string> = {
      // Percentuais de horas extras
      'Horas Extras 50%': 'Horas Extras 50%',
      'Horas Extras 100%': 'Horas Extras 100%',
      
      // Siglas compostas
      'Pis/pasep': 'PIS/PASEP',
      'Pis Pasep': 'PIS/PASEP',
      
      // Ordinais específicos
      '13º Salario': '13º Salário',
      '13º salário': '13º Salário',
      'Terceiro Salário': '13º Salário',
      
      // Correções de acentuação comuns
      'Salario': 'Salário',
      'Ferias': 'Férias',
      'Adicional de Transferencia': 'Adicional de Transferência',
      
      // Formatação de multas
      'Multa 40% Fgts': 'Multa 40% FGTS',
      'Multa Do Fgts': 'Multa do FGTS'
    };

    // Aplica correções específicas se encontradas
    let corrected = text;
    for (const [incorrect, correct] of Object.entries(corrections)) {
      if (corrected.toLowerCase() === incorrect.toLowerCase()) {
        corrected = correct;
        break;
      }
    }

    return corrected;
  }

  /**
   * Aplica Title Case básico para uma palavra
   * 
   * @param word - Palavra a ser capitalizada
   * @returns Palavra com primeira letra maiúscula
   */
  private static capitalizeFirst(word: string): string {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  /**
   * Title Case básico como fallback
   * 
   * @param input - Texto de entrada
   * @returns Texto em Title Case básico
   */
  private static basicTitleCase(input: string): string {
    return input
      .trim()
      .split(' ')
      .map(word => this.capitalizeFirst(word))
      .join(' ');
  }

  /**
   * Valida se um tipo de verba está em formato válido
   * 
   * Executa todas as verificações necessárias para garantir que o tipo
   * atende aos critérios de qualidade e padrões do sistema
   * 
   * @param tipoVerba - Tipo de verba a ser validado
   * @returns Resultado detalhado da validação com sugestões se aplicável
   */
  static validate(tipoVerba: string): TipoValidationResult {
    try {
      // Normaliza primeiro para ter o valor padrão
      const normalizedValue = this.normalize(tipoVerba);
      const trimmedInput = tipoVerba.trim();

      logger.info(
        `Validando tipo de verba: "${tipoVerba}"`,
        'TipoVerbaNormalizer.validate',
        { originalInput: tipoVerba, normalizedValue, trimmedInput }
      );

      // Verificação 1: Não pode estar vazio
      if (!trimmedInput) {
        return {
          isValid: false,
          errorMessage: 'Tipo de verba não pode estar vazio',
          normalizedValue: ''
        };
      }

      // Verificação 2: Comprimento mínimo
      if (trimmedInput.length < VERBA_CONSTANTS.MIN_TIPO_LENGTH) {
        return {
          isValid: false,
          errorMessage: `Tipo deve ter pelo menos ${VERBA_CONSTANTS.MIN_TIPO_LENGTH} caracteres`,
          normalizedValue
        };
      }

      // Verificação 3: Comprimento máximo
      if (trimmedInput.length > VERBA_CONSTANTS.MAX_TIPO_LENGTH) {
        return {
          isValid: false,
          errorMessage: `Tipo deve ter no máximo ${VERBA_CONSTANTS.MAX_TIPO_LENGTH} caracteres`,
          normalizedValue: trimmedInput.substring(0, VERBA_CONSTANTS.MAX_TIPO_LENGTH)
        };
      }

      // Verificação 4: Não pode ser apenas números ou símbolos
      const alphaCount = (trimmedInput.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
      if (alphaCount < 2) {
        return {
          isValid: false,
          errorMessage: 'Tipo deve conter pelo menos 2 letras',
          normalizedValue,
          suggestions: [
            'Adicione mais letras ao nome',
            'Exemplo: "Adicional 25%" é válido, "25%" não é'
          ]
        };
      }

      // Se chegou aqui, tipo é válido
      const result: TipoValidationResult = {
        isValid: true,
        normalizedValue
      };

      logger.success(
        `Tipo válido após validação: "${normalizedValue}"`,
        'TipoVerbaNormalizer.validate',
        { originalInput: tipoVerba, normalizedValue, isValid: true }
      );

      return result;

    } catch (error) {
      logger.errorWithException(
        `Erro na validação do tipo: "${tipoVerba}"`,
        error as Error,
        'TipoVerbaNormalizer.validate',
        { originalInput: tipoVerba }
      );

      // Em caso de erro, retorna inválido com valor normalizado básico
      return {
        isValid: false,
        errorMessage: 'Erro interno na validação',
        normalizedValue: this.basicTitleCase(tipoVerba)
      };
    }
  }

  /**
   * Verifica se dois tipos são equivalentes após normalização
   * 
   * Útil para comparar se uma "renomeação" é realmente uma mudança
   * ou apenas uma correção de formatação
   * 
   * @param tipo1 - Primeiro tipo para comparação
   * @param tipo2 - Segundo tipo para comparação
   * @returns true se os tipos são equivalentes após normalização
   */
  static areEquivalent(tipo1: string, tipo2: string): boolean {
    const normalized1 = this.normalize(tipo1);
    const normalized2 = this.normalize(tipo2);
    
    const areEqual = normalized1 === normalized2;
    
    logger.info(
      `Comparação de tipos: "${tipo1}" vs "${tipo2}" = ${areEqual ? 'equivalentes' : 'diferentes'}`,
      'TipoVerbaNormalizer.areEquivalent',
      { 
        tipo1, 
        tipo2, 
        normalized1, 
        normalized2, 
        areEqual 
      }
    );

    return areEqual;
  }

  /**
   * Gera sugestões de correção para tipos inválidos
   * 
   * Analisa o tipo fornecido e sugere correções possíveis
   * baseado em padrões comuns de erro
   * 
   * @param invalidTipo - Tipo inválido para análise
   * @returns Array de sugestões de correção
   */
  static generateSuggestions(invalidTipo: string): string[] {
    const suggestions: string[] = [];
    
    try {
      const trimmed = invalidTipo.trim();
      
      // Sugestão 1: Versão normalizada básica
      const normalized = this.normalize(trimmed);
      if (normalized !== trimmed && this.validate(normalized).isValid) {
        suggestions.push(`Correção automática: "${normalized}"`);
      }
      
      // Sugestão 2: Versões comuns baseadas em palavras-chave
      if (trimmed.toLowerCase().includes('hora')) {
        suggestions.push('Exemplo: "Horas Extras 50%"');
      }
      if (trimmed.toLowerCase().includes('adicional')) {
        suggestions.push('Exemplo: "Adicional Noturno", "Adicional de Transferência"');
      }
      if (trimmed.toLowerCase().includes('dano')) {
        suggestions.push('Exemplo: "Danos Morais"');
      }

      logger.info(
        `Geradas ${suggestions.length} sugestões para tipo inválido: "${invalidTipo}"`,
        'TipoVerbaNormalizer.generateSuggestions',
        { invalidTipo, suggestions }
      );

    } catch (error) {
      logger.errorWithException(
        `Erro ao gerar sugestões para: "${invalidTipo}"`,
        error as Error,
        'TipoVerbaNormalizer.generateSuggestions',
        { invalidTipo }
      );
    }

    return suggestions;
  }

  /**
   * Valida e normaliza um tipo em uma única operação
   * 
   * Função de conveniência que combina validação e normalização,
   * retornando o resultado completo da operação
   * 
   * @param input - Tipo de entrada
   * @returns Resultado completo com validação e valor normalizado
   */
  static validateAndNormalize(input: string): TipoValidationResult {
    // Primeiro normaliza
    const normalizedValue = this.normalize(input);
    
    // Depois valida o valor normalizado
    const validation = this.validate(normalizedValue);
    
    // Se inválido, inclui sugestões
    if (!validation.isValid) {
      validation.suggestions = this.generateSuggestions(input);
    }
    
    return validation;
  }

  /**
   * Compara dois tipos e determina se uma renomeação é necessária
   * 
   * @param tipoAntigo - Tipo atual
   * @param tipoNovo - Tipo proposto
   * @returns Objeto com informações sobre a necessidade de renomeação
   */
  static compareForRename(tipoAntigo: string, tipoNovo: string): {
    needsRename: boolean;
    normalizedOld: string;
    normalizedNew: string;
    isOnlyFormatting: boolean;
  } {
    const normalizedOld = this.normalize(tipoAntigo);
    const normalizedNew = this.normalize(tipoNovo);
    
    const areEquivalent = normalizedOld === normalizedNew;
    const needsRename = !areEquivalent;
    const isOnlyFormatting = !needsRename && tipoAntigo !== normalizedOld;

    logger.info(
      `Comparação para renomeação: "${tipoAntigo}" → "${tipoNovo}"`,
      'TipoVerbaNormalizer.compareForRename',
      { 
        tipoAntigo, 
        tipoNovo, 
        normalizedOld, 
        normalizedNew, 
        needsRename, 
        isOnlyFormatting 
      }
    );

    return {
      needsRename,
      normalizedOld,
      normalizedNew,
      isOnlyFormatting
    };
  }

  static sanitizeForDisplay(text: string): string {
    if (!text) return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export default TipoVerbaNormalizer;