/**
 * Hook para gerenciamento de enums dinâmicos
 * 
 * Este hook facilita o uso de valores dinâmicos de enum nos componentes,
 * fornecendo funcionalidades para:
 * - Combinar valores predefinidos com valores personalizados
 * - Adicionar novos valores aos enums automaticamente
 * - Cache inteligente para performance
 * - Validação automática de entrada
 * - Integração transparente com componentes existentes
 * 
 * O hook abstrai a complexidade do sistema de enums dinâmicos,
 * permitindo que os componentes trabalhem de forma simples e intuitiva.
 */

import { useState, useCallback, useEffect } from 'react';
import { DynamicEnumService, DynamicEnumType, AddValueResult } from '../services/dynamicEnum.service';
import { logger } from '../utils';

/**
 * Interface para valores combinados (predefinidos + dinâmicos)
 */
export interface EnumValues {
  all: readonly string[];         // Todos os valores disponíveis
  predefined: readonly string[];  // Valores predefinidos originais
  custom: readonly string[];      // Valores personalizados adicionados
}

/**
 * Interface de retorno do hook
 */
interface UseDynamicEnumsReturn {
  getCombinedValues: (
    enumType: DynamicEnumType,
    predefinedValues: readonly string[],
    processId?: string
  ) => Promise<EnumValues>;

  getValuesFromDatabase: (
    enumType: DynamicEnumType,
    processId?: string
  ) => Promise<EnumValues>;

  addCustomValue: (
    enumType: DynamicEnumType,
    value: string,
    processId?: string
  ) => Promise<AddValueResult>;

  ensureValueExists: (
    enumType: DynamicEnumType,
    value: string,
    predefinedValues: readonly string[],
    processId?: string
  ) => Promise<boolean>;

  isLoading: boolean;
  error: string | null;

  clearCache: () => void;
  refreshEnumValues: (enumType: DynamicEnumType, processId?: string) => Promise<void>;
}

/**
 * Hook personalizado para gerenciamento de enums dinâmicos
 * 
 * Este hook fornece uma interface simples para trabalhar com enums
 * que podem ser expandidos dinamicamente pelos usuários do sistema.
 * 
 * @returns Objeto com funções e estados para gerenciar enums dinâmicos
 */
export const useDynamicEnums = (): UseDynamicEnumsReturn => {
  
  // Estados do hook
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Cache local de valores já carregados para otimizar performance
   * Evita consultas repetidas ao banco de dados
   */
  const [enumCache, setEnumCache] = useState<Map<string, string[]>>(new Map());
  
  /**
   * Combina valores predefinidos com valores personalizados do enum
   *
   * Busca valores considerando o contexto do processo:
   * - Valores predefinidos (hardcoded)
   * - Valores globais (sem processo vinculado)
   * - Valores do processo especifico (se processId fornecido)
   *
   * @param enumType - Tipo do enum a ser consultado
   * @param predefinedValues - Array de valores predefinidos do enum
   * @param processId - ID do processo para filtrar valores especificos (opcional)
   * @returns Promise<EnumValues> - Objeto com valores combinados
   */
  const getCombinedValues = useCallback(async (
    enumType: DynamicEnumType,
    predefinedValues: readonly string[],
    processId?: string
  ): Promise<EnumValues> => {
    try {
      setError(null);
      setIsLoading(true);

      const cacheKey = `combined_${enumType}_${processId || 'global'}`;
      if (enumCache.has(cacheKey)) {
        const cachedValues = enumCache.get(cacheKey)!;

        logger.info(
          `Valores do enum carregados do cache: ${enumType}`,
          'useDynamicEnums.getCombinedValues',
          { enumType, processId, cacheHit: true, totalValues: cachedValues.length }
        );

        return {
          all: Object.freeze(cachedValues),
          predefined: predefinedValues,
          custom: Object.freeze(cachedValues.filter(v => !predefinedValues.includes(v)))
        };
      }

      const customEnumValues = await DynamicEnumService.getCustomValuesForEnum(enumType, processId);
      const customValues = customEnumValues.map(cev => cev.enumValue);

      const allValuesSet = new Set([...predefinedValues, ...customValues]);
      const allValues = Array.from(allValuesSet).sort();

      setEnumCache(prev => new Map(prev).set(cacheKey, allValues));

      logger.success(
        `Valores combinados para ${enumType}: ${predefinedValues.length} predefinidos + ${customValues.length} personalizados = ${allValues.length} total`,
        'useDynamicEnums.getCombinedValues',
        {
          enumType,
          processId,
          predefinedCount: predefinedValues.length,
          customCount: customValues.length,
          totalCount: allValues.length
        }
      );

      return {
        all: Object.freeze(allValues),
        predefined: predefinedValues,
        custom: Object.freeze(customValues)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar valores do enum';
      setError(errorMessage);

      logger.errorWithException(
        `Falha ao combinar valores para enum: ${enumType}`,
        error as Error,
        'useDynamicEnums.getCombinedValues',
        { enumType, processId }
      );

      return {
        all: predefinedValues,
        predefined: predefinedValues,
        custom: Object.freeze([])
      };
    } finally {
      setIsLoading(false);
    }
  }, [enumCache]);

  /**
   * Busca valores combinados do banco (predefinidos da tabela dropdown_options + customizados)
   *
   * @param enumType - Tipo do enum a ser consultado
   * @param processId - ID do processo para filtrar valores especificos (opcional)
   * @returns Promise<EnumValues> - Objeto com valores combinados
   */
  const getValuesFromDatabase = useCallback(async (
    enumType: DynamicEnumType,
    processId?: string
  ): Promise<EnumValues> => {
    try {
      setError(null);
      setIsLoading(true);

      const cacheKey = `db_${enumType}_${processId || 'global'}`;
      if (enumCache.has(cacheKey)) {
        const cachedValues = enumCache.get(cacheKey)!;

        logger.info(
          `Valores do enum carregados do cache (DB): ${enumType}`,
          'useDynamicEnums.getValuesFromDatabase',
          { enumType, processId, cacheHit: true, totalValues: cachedValues.length }
        );

        const predefinedValues = await DynamicEnumService.getPredefinedValues(enumType);

        return {
          all: Object.freeze(cachedValues),
          predefined: Object.freeze(predefinedValues),
          custom: Object.freeze(cachedValues.filter(v => !predefinedValues.includes(v)))
        };
      }

      const predefinedValues = await DynamicEnumService.getPredefinedValues(enumType);

      const customEnumValues = await DynamicEnumService.getCustomValuesForEnum(enumType, processId);
      const customValues = customEnumValues.map(cev => cev.enumValue);

      const allValuesSet = new Set([...predefinedValues, ...customValues]);
      const allValues = Array.from(allValuesSet).sort((a, b) => {
        const aIsPredefined = predefinedValues.includes(a);
        const bIsPredefined = predefinedValues.includes(b);
        if (aIsPredefined && !bIsPredefined) return -1;
        if (!aIsPredefined && bIsPredefined) return 1;
        const aIndex = predefinedValues.indexOf(a);
        const bIndex = predefinedValues.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        return a.localeCompare(b);
      });

      setEnumCache(prev => new Map(prev).set(cacheKey, allValues));

      logger.success(
        `Valores do banco para ${enumType}: ${predefinedValues.length} predefinidos + ${customValues.length} personalizados = ${allValues.length} total`,
        'useDynamicEnums.getValuesFromDatabase',
        {
          enumType,
          processId,
          predefinedCount: predefinedValues.length,
          customCount: customValues.length,
          totalCount: allValues.length
        }
      );

      return {
        all: Object.freeze(allValues),
        predefined: Object.freeze(predefinedValues),
        custom: Object.freeze(customValues)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar valores do banco';
      setError(errorMessage);

      logger.errorWithException(
        `Falha ao buscar valores do banco para enum: ${enumType}`,
        error as Error,
        'useDynamicEnums.getValuesFromDatabase',
        { enumType, processId }
      );

      return {
        all: Object.freeze([]),
        predefined: Object.freeze([]),
        custom: Object.freeze([])
      };
    } finally {
      setIsLoading(false);
    }
  }, [enumCache]);

  /**
   * Adiciona um novo valor personalizado a um enum
   * 
   * Esta função permite que usuários adicionem valores personalizados
   * aos enums do sistema, expandindo as opções disponíveis dinamicamente.
   * O valor é adicionado ao enum do PostgreSQL e registrado no histórico.
   * 
   * @param enumType - Tipo do enum a receber o novo valor
   * @param value - Valor personalizado a ser adicionado
   * @param processId - ID do processo que está criando o valor (opcional)
   * @returns Promise<AddValueResult> - Resultado detalhado da operação
   */
  const addCustomValue = useCallback(async (
    enumType: DynamicEnumType,
    value: string,
    processId?: string
  ): Promise<AddValueResult> => {
    try {
      setError(null);
      
      logger.info(
        `Adicionando valor personalizado: "${value}" ao enum ${enumType}`,
        'useDynamicEnums.addCustomValue',
        { enumType, value, processId }
      );
      
      // Adiciona o valor através do serviço
      const result = await DynamicEnumService.addValueToEnum(enumType, value, processId);
      
      if (result.success) {
        // Invalida cache para forçar recarregamento na próxima consulta
        const cacheKey = `combined_${enumType}`;
        setEnumCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(cacheKey);
          return newCache;
        });
        
        logger.success(
          `Valor personalizado adicionado ao enum: "${result.normalizedValue}"`,
          'useDynamicEnums.addCustomValue',
          { 
            enumType, 
            originalValue: value, 
            normalizedValue: result.normalizedValue,
            wasAlreadyPresent: result.wasAlreadyPresent,
            processId 
          }
        );
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar valor personalizado';
      setError(errorMessage);
      
      logger.errorWithException(
        `Falha ao adicionar valor personalizado: "${value}" ao enum ${enumType}`,
        error as Error,
        'useDynamicEnums.addCustomValue',
        { enumType, value, processId }
      );
      
      return {
        success: false,
        message: errorMessage,
        wasAlreadyPresent: false,
        normalizedValue: value.trim()
      };
    }
  }, []);
  
  /**
   * Garante que um valor existe no enum (adiciona se necessário)
   * 
   * Esta função é chamada automaticamente quando um usuário digita
   * um valor que não está na lista atual do enum. Se o valor não existir,
   * ele será adicionado automaticamente ao enum do banco de dados.
   * 
   * @param enumType - Tipo do enum
   * @param value - Valor a ser verificado/adicionado
   * @param predefinedValues - Array de valores predefinidos para comparação
   * @param processId - ID do processo que está utilizando o valor (opcional)
   * @returns Promise<boolean> - true se o valor existe ou foi adicionado com sucesso
   */
  const ensureValueExists = useCallback(async (
    enumType: DynamicEnumType,
    value: string,
    predefinedValues: readonly string[],
    processId?: string
  ): Promise<boolean> => {
    try {
      setError(null);
      
      // Normaliza o valor para comparação
      const normalizedValue = value.trim();
      if (!normalizedValue) return false;
      
      // Se o valor está nos predefinidos, não precisa adicionar
      if (predefinedValues.includes(normalizedValue)) {
        logger.info(
          `Valor já existe nos predefinidos: "${normalizedValue}"`,
          'useDynamicEnums.ensureValueExists',
          { enumType, value: normalizedValue, processId }
        );
        return true;
      }
      
      // Verifica se já existe no enum do banco (considerando contexto do processo)
      const existsInEnum = await DynamicEnumService.valueExistsInEnum(enumType, normalizedValue, processId);
      if (existsInEnum) {
        logger.info(
          `Valor já existe no enum: "${normalizedValue}"${processId ? ` para processo ${processId}` : ' (global)'}`,
          'useDynamicEnums.ensureValueExists',
          { enumType, value: normalizedValue, processId }
        );
        return true;
      }
      
      // Adiciona como valor personalizado
      const result = await addCustomValue(enumType, normalizedValue, processId);
      
      logger.info(
        `Valor garantido no enum: "${normalizedValue}" - ${result.success ? 'sucesso' : 'falha'}${processId ? ` para processo ${processId}` : ' (global)'}`,
        'useDynamicEnums.ensureValueExists',
        { 
          enumType, 
          value: normalizedValue, 
          success: result.success,
          message: result.message 
        }
      );
      
      return result.success;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar valor';
      setError(errorMessage);
      
      logger.errorWithException(
        `Falha ao garantir existência do valor: "${value}" no enum ${enumType}`,
        error as Error,
        'useDynamicEnums.ensureValueExists',
        { enumType, value, processId }
      );
      
      // Em caso de erro, retorna true para não bloquear o usuário
      return true;
    }
  }, [addCustomValue]);
  
  /**
   * Forca recarregamento dos valores de um enum especifico
   *
   * Remove o cache e forca uma nova consulta ao banco de dados
   * na proxima chamada de getCombinedValues.
   *
   * @param enumType - Tipo do enum a ser recarregado
   * @param processId - ID do processo para invalidar cache especifico (opcional)
   */
  const refreshEnumValues = useCallback(async (enumType: DynamicEnumType, processId?: string): Promise<void> => {
    try {
      setError(null);

      setEnumCache(prev => {
        const newCache = new Map(prev);
        if (processId) {
          newCache.delete(`combined_${enumType}_${processId}`);
        }
        newCache.delete(`combined_${enumType}_global`);
        return newCache;
      });

      DynamicEnumService.clearAllCache();

      logger.info(
        `Cache do enum ${enumType} invalidado - proxima consulta recarregara do banco`,
        'useDynamicEnums.refreshEnumValues',
        { enumType, processId }
      );

    } catch (error) {
      logger.errorWithException(
        `Erro ao recarregar enum: ${enumType}`,
        error as Error,
        'useDynamicEnums.refreshEnumValues',
        { enumType, processId }
      );
    }
  }, []);
  
  /**
   * Limpa todo o cache de enums
   * 
   * Força recarregamento de todos os enums na próxima utilização
   */
  const clearCache = useCallback(() => {
    setEnumCache(new Map());
    DynamicEnumService.clearAllCache();
    
    logger.info(
      'Todo cache de enums dinâmicos limpo pelo hook',
      'useDynamicEnums.clearCache'
    );
  }, []);
  
  /**
   * Effect para limpeza ao desmontar o componente
   * Não limpa cache automaticamente para permitir reutilização
   */
  useEffect(() => {
    return () => {
      // Não limpa cache automaticamente - preserva para reutilização
      logger.info(
        'Hook useDynamicEnums desmontado, cache preservado',
        'useDynamicEnums.cleanup'
      );
    };
  }, []);
  
  return {
    getCombinedValues,
    getValuesFromDatabase,
    addCustomValue,
    ensureValueExists,
    isLoading,
    error,
    clearCache,
    refreshEnumValues
  };
};

export default useDynamicEnums;