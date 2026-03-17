import { useState, useCallback, useRef } from 'react';
import { DynamicEnumService, DynamicEnumType, AddValueResult } from '../services/dynamicEnum.service';
import { logger } from '../utils';

export interface EnumValues {
  all: readonly string[];
  predefined: readonly string[];
  custom: readonly string[];
}

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

  renameCustomValue: (
    enumType: DynamicEnumType,
    oldValue: string,
    newValue: string,
    processId?: string
  ) => Promise<{ success: boolean; message: string }>;

  deleteCustomValue: (
    enumType: DynamicEnumType,
    value: string,
    processId?: string
  ) => Promise<{ success: boolean; message: string }>;

  getPredefinedValues: (enumType: DynamicEnumType) => Promise<string[]>;

  isLoading: boolean;
  error: string | null;

  clearCache: () => void;
  refreshEnumValues: (enumType: DynamicEnumType, processId?: string) => Promise<void>;
}

const ENUM_CACHE_MAX_SIZE = 128;

export const useDynamicEnums = (): UseDynamicEnumsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestsRef = useRef(0);

  const beginLoading = useCallback(() => {
    activeRequestsRef.current += 1;
    setIsLoading(true);
  }, []);

  const endLoading = useCallback(() => {
    activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
    if (activeRequestsRef.current === 0) {
      endLoading();
    }
  }, []);

  const enumCacheRef = useRef<Map<string, string[]>>(new Map());

  const setCacheValue = useCallback((key: string, value: string[]) => {
    const cache = enumCacheRef.current;
    if (cache.size >= ENUM_CACHE_MAX_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, value);
  }, []);

  const getCombinedValues = useCallback(async (
    enumType: DynamicEnumType,
    predefinedValues: readonly string[],
    processId?: string
  ): Promise<EnumValues> => {
    try {
      setError(null);
      beginLoading();

      const cacheKey = `combined_${enumType}_${processId || 'global'}`;
      const cached = enumCacheRef.current.get(cacheKey);
      if (cached) {
        return {
          all: Object.freeze(cached),
          predefined: predefinedValues,
          custom: Object.freeze(cached.filter(v => !predefinedValues.includes(v)))
        };
      }

      const customEnumValues = await DynamicEnumService.getCustomValuesForEnum(enumType, processId);
      const customValues = customEnumValues.map(cev => cev.enumValue);

      const allValues = Array.from(new Set([...predefinedValues, ...customValues])).sort();
      setCacheValue(cacheKey, allValues);

      return {
        all: Object.freeze(allValues),
        predefined: predefinedValues,
        custom: Object.freeze(customValues)
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar valores do enum';
      setError(errorMessage);

      logger.errorWithException(
        `Falha ao combinar valores para enum: ${enumType}`,
        err as Error,
        'useDynamicEnums.getCombinedValues',
        { enumType, processId }
      );

      return {
        all: predefinedValues,
        predefined: predefinedValues,
        custom: Object.freeze([])
      };
    } finally {
      endLoading();
    }
  }, [setCacheValue, beginLoading, endLoading]);

  const getValuesFromDatabase = useCallback(async (
    enumType: DynamicEnumType,
    processId?: string
  ): Promise<EnumValues> => {
    try {
      setError(null);
      beginLoading();

      const cacheKey = `db_${enumType}_${processId || 'global'}`;
      const cached = enumCacheRef.current.get(cacheKey);
      if (cached) {
        const predefinedValues = await DynamicEnumService.getPredefinedValues(enumType);
        return {
          all: Object.freeze(cached),
          predefined: Object.freeze(predefinedValues),
          custom: Object.freeze(cached.filter(v => !predefinedValues.includes(v)))
        };
      }

      const predefinedValues = await DynamicEnumService.getPredefinedValues(enumType);
      const customEnumValues = await DynamicEnumService.getCustomValuesForEnum(enumType, processId);
      const customValues = customEnumValues.map(cev => cev.enumValue);

      const allValues = Array.from(new Set([...predefinedValues, ...customValues])).sort((a, b) => {
        const aIsPredefined = predefinedValues.includes(a);
        const bIsPredefined = predefinedValues.includes(b);
        if (aIsPredefined && !bIsPredefined) return -1;
        if (!aIsPredefined && bIsPredefined) return 1;
        const aIndex = predefinedValues.indexOf(a);
        const bIndex = predefinedValues.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        return a.localeCompare(b);
      });

      setCacheValue(cacheKey, allValues);

      return {
        all: Object.freeze(allValues),
        predefined: Object.freeze(predefinedValues),
        custom: Object.freeze(customValues)
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar valores do banco';
      setError(errorMessage);

      logger.errorWithException(
        `Falha ao buscar valores do banco para enum: ${enumType}`,
        err as Error,
        'useDynamicEnums.getValuesFromDatabase',
        { enumType, processId }
      );

      return {
        all: Object.freeze([]),
        predefined: Object.freeze([]),
        custom: Object.freeze([])
      };
    } finally {
      endLoading();
    }
  }, [setCacheValue, beginLoading, endLoading]);

  const addCustomValue = useCallback(async (
    enumType: DynamicEnumType,
    value: string,
    processId?: string
  ): Promise<AddValueResult> => {
    try {
      setError(null);

      const result = await DynamicEnumService.addValueToEnum(enumType, value, processId);

      if (result.success) {
        const cache = enumCacheRef.current;
        const prefixCombined = `combined_${enumType}`;
        for (const key of Array.from(cache.keys())) {
          if (key.startsWith(prefixCombined)) {
            cache.delete(key);
          }
        }
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar valor personalizado';
      setError(errorMessage);

      logger.errorWithException(
        `Falha ao adicionar valor personalizado: "${value}" ao enum ${enumType}`,
        err as Error,
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

  const ensureValueExists = useCallback(async (
    enumType: DynamicEnumType,
    value: string,
    predefinedValues: readonly string[],
    processId?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const normalizedValue = value.trim();
      if (!normalizedValue) return false;

      if (predefinedValues.includes(normalizedValue)) {
        return true;
      }

      const existsInEnum = await DynamicEnumService.valueExistsInEnum(enumType, normalizedValue, processId);
      if (existsInEnum) {
        return true;
      }

      const result = await addCustomValue(enumType, normalizedValue, processId);
      return result.success;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao verificar valor';
      setError(errorMessage);

      logger.errorWithException(
        `Falha ao garantir existência do valor: "${value}" no enum ${enumType}`,
        err as Error,
        'useDynamicEnums.ensureValueExists',
        { enumType, value, processId }
      );

      return false;
    }
  }, [addCustomValue]);

  const refreshEnumValues = useCallback(async (enumType: DynamicEnumType, processId?: string): Promise<void> => {
    try {
      setError(null);

      const cache = enumCacheRef.current;
      const prefixCombined = `combined_${enumType}`;
      const prefixDb = `db_${enumType}`;
      for (const key of Array.from(cache.keys())) {
        if (key.startsWith(prefixCombined) || key.startsWith(prefixDb)) {
          if (!processId || key.includes(processId) || key.endsWith('_global')) {
            cache.delete(key);
          }
        }
      }

      DynamicEnumService.clearAllCache();
    } catch (err) {
      logger.error(`Erro ao recarregar enum: ${enumType}`, 'useDynamicEnums.refreshEnumValues');
    }
  }, []);

  const renameCustomValue = useCallback(async (
    enumType: DynamicEnumType,
    oldValue: string,
    newValue: string,
    processId?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setError(null);
      const result = await DynamicEnumService.renameCustomValue(enumType, oldValue, newValue, processId);
      if (result.success) {
        const cache = enumCacheRef.current;
        for (const key of Array.from(cache.keys())) {
          if (key.includes(enumType)) cache.delete(key);
        }
        DynamicEnumService.clearAllCache();
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao renomear';
      setError(msg);
      return { success: false, message: msg };
    }
  }, []);

  const deleteCustomValue = useCallback(async (
    enumType: DynamicEnumType,
    value: string,
    processId?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setError(null);
      const result = await DynamicEnumService.deleteCustomValue(enumType, value, processId);
      if (result.success) {
        const cache = enumCacheRef.current;
        for (const key of Array.from(cache.keys())) {
          if (key.includes(enumType)) cache.delete(key);
        }
        DynamicEnumService.clearAllCache();
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir';
      setError(msg);
      return { success: false, message: msg };
    }
  }, []);

  const getPredefinedValues = useCallback(async (enumType: DynamicEnumType): Promise<string[]> => {
    return DynamicEnumService.getPredefinedValues(enumType);
  }, []);

  const clearCache = useCallback(() => {
    enumCacheRef.current.clear();
    DynamicEnumService.clearAllCache();
  }, []);

  return {
    getCombinedValues,
    getValuesFromDatabase,
    addCustomValue,
    ensureValueExists,
    renameCustomValue,
    deleteCustomValue,
    getPredefinedValues,
    isLoading,
    error,
    clearCache,
    refreshEnumValues
  };
};

export default useDynamicEnums;
