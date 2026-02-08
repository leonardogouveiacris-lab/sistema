/**
 * Serviço para gerenciamento de valores dinâmicos em enums do banco de dados
 * 
 * Este serviço permite adicionar valores personalizados aos enums do PostgreSQL
 * de forma dinâmica, mantendo a integridade referencial e rastreando qual
 * processo criou cada valor personalizado.
 * 
 * Funcionalidades:
 * - Adiciona valores aos enums existentes do banco
 * - Registra histórico de valores personalizados criados
 * - Normalização automática de valores
 * - Validação de duplicatas
 * - Cache inteligente para performance
 * - Integração transparente com os componentes existentes
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils';

/**
 * Enum para tipos de campos que suportam valores dinâmicos
 * Define quais enums do banco podem receber valores personalizados
 */
export enum DynamicEnumType {
  TIPO_VERBA = 'tipo_verba',
  SITUACAO_VERBA = 'situacao_verba',
  TIPO_DECISAO = 'tipo_decisao',
  SITUACAO_DECISAO = 'situacao_decisao',
  TIPO_DOCUMENTO = 'tipo_documento',
  TIPO_DOCUMENTO_PDF = 'tipo_documento_pdf'
}

/**
 * Interface para registro de valor personalizado do enum
 */
export interface CustomEnumValue {
  id: string;
  enumName: string;
  enumValue: string;
  createdByProcessId: string | null;
  createdAt: Date;
}

/**
 * Interface para opcao de dropdown do banco
 */
export interface DropdownOption {
  id: string;
  dropdownName: string;
  optionValue: string;
  displayOrder: number;
  isActive: boolean;
}

/**
 * Interface para resultado da operação de adição de valor
 */
export interface AddValueResult {
  success: boolean;
  message: string;
  wasAlreadyPresent: boolean;
  normalizedValue: string;
}

/**
 * Classe de serviço para gerenciar enums dinâmicos
 */
export class DynamicEnumService {
  
  /**
   * Cache local para valores já verificados
   * Melhora performance evitando consultas repetidas
   */
  private static cache = new Map<string, Set<string>>();
  
  /**
   * Gera chave única para o cache baseada no nome do enum
   * 
   * @param enumName - Nome do enum
   * @returns Chave única para o cache
   */
  private static getCacheKey(enumName: string): string {
    return `enum_values:${enumName}`;
  }
  
  /**
   * Normaliza um valor de enum seguindo padrão de capitalização
   * Aplica initcap (primeira letra de cada palavra maiúscula)
   * 
   * @param value - Valor a ser normalizado
   * @returns Valor normalizado no padrão adequado
   */
  private static normalizeEnumValue(value: string): string {
    return value.trim()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }
  
  /**
   * Verifica se um valor já existe em um enum específico
   * Usa cache para otimizar consultas repetidas e considera contexto do processo
   * 
   * @param enumName - Nome do enum (ex: 'tipo_verba')
   * @param value - Valor a ser verificado
   * @param processId - ID do processo (opcional) para verificar contexto específico
   * @returns Promise<boolean> - true se o valor já existe
   */
  static async valueExistsInEnum(enumName: string, value: string, processId?: string): Promise<boolean> {
    try {
      const normalizedValue = this.normalizeEnumValue(value);
      const cacheKey = this.getCacheKey(enumName + (processId || 'global'));
      
      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, assumindo valor não existe', 'DynamicEnumService.valueExistsInEnum', { processId });
        return false;
      }

      // Verifica cache primeiro
      if (this.cache.has(cacheKey)) {
        const cachedValues = this.cache.get(cacheKey)!;
        const exists = cachedValues.has(normalizedValue);
        
        if (exists) {
          logger.info(
            `Valor encontrado no cache: "${normalizedValue}" em ${enumName}`,
            'DynamicEnumService.valueExistsInEnum',
            { enumName, value: normalizedValue, cacheHit: true }
          );
          return true;
        }
      }
      
      // Se não está no cache, verifica no banco fazendo um cast
      logger.info(
        `Verificando existência do valor no banco: "${normalizedValue}" em ${enumName}${processId ? ` para processo ${processId}` : ' (global)'}`,
        'DynamicEnumService.valueExistsInEnum',
        { enumName, value: normalizedValue, processId }
      );
      
      // Usa função SQL atualizada para verificar considerando contexto do processo
      const { data, error } = await supabase.rpc('check_enum_value_exists', {
        p_enum_name: enumName,
        p_enum_value: normalizedValue,
        p_process_id: processId || null
      });
      
      if (error) {
        // Se a função não existir ou houver erro, tentamos criar o valor diretamente
        logger.warn(
          `Erro na função check_enum_value_exists: ${error.message}, assumindo valor não existe`,
          'DynamicEnumService.valueExistsInEnum',
          { enumName, value: normalizedValue, processId, error: error.message }
        );
        return false;
      }
      
      const exists = data === true;
      
      // Atualiza cache se o valor existe
      if (exists) {
        if (!this.cache.has(cacheKey)) {
          this.cache.set(cacheKey, new Set());
        }
        this.cache.get(cacheKey)!.add(normalizedValue);
      }
      
      return exists;
      
    } catch (error) {
      logger.errorWithException(
        `Erro ao verificar existência do valor no enum: "${value}"`,
        error as Error,
        'DynamicEnumService.valueExistsInEnum',
        { enumName, value, processId }
      );
      
      // Em caso de erro, assume que não existe para tentar adicionar
      return false;
    }
  }
  
  /**
   * Adiciona um novo valor a um enum do banco de dados
   * 
   * Esta função utiliza a stored procedure criada no banco para adicionar
   * valores de forma segura aos enums PostgreSQL, registrando o histórico
   * e associando o valor ao processo que o criou.
   * 
   * @param enumName - Nome do enum no banco (ex: 'tipo_verba')
   * @param value - Valor a ser adicionado
   * @param processId - ID do processo que está criando o valor (opcional)
   * @returns Promise<AddValueResult> - Resultado detalhado da operação
   */
  static async addValueToEnum(
    enumName: DynamicEnumType,
    value: string,
    processId?: string
  ): Promise<AddValueResult> {
    try {
      const normalizedValue = this.normalizeEnumValue(value);
      
      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, não é possível adicionar valor', 'DynamicEnumService.addValueToEnum');
        return {
          success: false,
          message: `Supabase não configurado`,
          wasAlreadyPresent: false,
          normalizedValue
        };
      }

      logger.info(
        `Tentando adicionar valor ao enum: "${normalizedValue}" em ${enumName}`,
        'DynamicEnumService.addValueToEnum',
        {
          enumName,
          originalValue: value,
          normalizedValue,
          processId
        }
      );

      // Chama a função do banco para adicionar o valor
      const { data, error } = await supabase.rpc('add_custom_enum_value', {
        p_enum_name: enumName,
        p_enum_value: normalizedValue,
        p_process_id: processId || null
      });

      if (error) {
        throw new Error(`Erro ao adicionar valor ao enum: ${error.message}`);
      }

      // Valida o retorno da função
      if (!data) {
        throw new Error('Função add_custom_enum_value não retornou dados');
      }

      // Log detalhado do resultado
      logger.info(
        'Resposta da função add_custom_enum_value',
        'DynamicEnumService.addValueToEnum',
        {
          data,
          inserted: data.inserted,
          alreadyExisted: data.already_existed,
          normalizedValue: data.normalized_value
        }
      );

      // Invalida cache para forçar recarregamento
      this.invalidateCache(enumName);

      const result: AddValueResult = {
        success: data.inserted || data.already_existed,
        message: data.already_existed
          ? `Valor "${data.normalized_value}" já existia no enum ${enumName}`
          : `Valor "${data.normalized_value}" adicionado ao enum ${enumName}`,
        wasAlreadyPresent: data.already_existed,
        normalizedValue: data.normalized_value
      };

      logger.success(
        result.message,
        'DynamicEnumService.addValueToEnum',
        {
          enumName,
          value: normalizedValue,
          processId,
          wasAlreadyPresent: result.wasAlreadyPresent,
          success: result.success,
          inserted: data.inserted
        }
      );

      return result;
      
    } catch (error) {
      const errorMessage = `Falha ao adicionar valor "${value}" ao enum ${enumName}`;
      
      logger.errorWithException(
        errorMessage,
        error as Error,
        'DynamicEnumService.addValueToEnum',
        { enumName, value, processId }
      );
      
      return {
        success: false,
        message: errorMessage,
        wasAlreadyPresent: false,
        normalizedValue: this.normalizeEnumValue(value)
      };
    }
  }
  
  /**
   * Busca valores personalizados criados para um enum, filtrando por processo
   *
   * Retorna valores que são:
   * - Globais (created_by_process_id é null)
   * - Criados pelo processo especificado (se processId fornecido)
   *
   * @param enumName - Nome do enum
   * @param processId - ID do processo para filtrar valores específicos (opcional)
   * @returns Promise<CustomEnumValue[]> - Lista de valores personalizados
   */
  static async getCustomValuesForEnum(enumName: string, processId?: string): Promise<CustomEnumValue[]> {
    try {
      if (!supabase) {
        logger.warn('Supabase não configurado, retornando array vazio', 'DynamicEnumService.getCustomValuesForEnum');
        return [];
      }

      logger.info(
        `Buscando valores personalizados do enum: ${enumName}${processId ? ` para processo ${processId}` : ' (globais)'}`,
        'DynamicEnumService.getCustomValuesForEnum',
        { enumName, processId }
      );

      const { data: globalData, error: globalError } = await supabase
        .from('custom_enum_values')
        .select('*')
        .eq('enum_name', enumName)
        .is('created_by_process_id', null)
        .order('enum_value');

      if (globalError) {
        throw new Error(`Erro ao buscar valores globais: ${globalError.message}`);
      }

      let processData: typeof globalData = [];
      if (processId) {
        const { data, error } = await supabase
          .from('custom_enum_values')
          .select('*')
          .eq('enum_name', enumName)
          .eq('created_by_process_id', processId)
          .order('enum_value');

        if (error) {
          throw new Error(`Erro ao buscar valores do processo: ${error.message}`);
        }
        processData = data || [];
      }

      const allData = [...(globalData || []), ...processData];

      const customValues = allData.map(record => ({
        id: record.id,
        enumName: record.enum_name,
        enumValue: record.enum_value,
        createdByProcessId: record.created_by_process_id,
        createdAt: new Date(record.created_at)
      }));

      logger.success(
        `${customValues.length} valores personalizados encontrados para ${enumName}${processId ? ` (${globalData?.length || 0} globais + ${processData.length} do processo)` : ''}`,
        'DynamicEnumService.getCustomValuesForEnum',
        { enumName, processId, count: customValues.length }
      );

      return customValues;

    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar valores personalizados para enum: ${enumName}`,
        error as Error,
        'DynamicEnumService.getCustomValuesForEnum',
        { enumName, processId }
      );

      return [];
    }
  }
  
  /**
   * Busca valores personalizados criados por um processo específico
   * 
   * @param processId - ID do processo
   * @param enumName - Nome do enum (opcional, para filtrar)
   * @returns Promise<CustomEnumValue[]> - Lista de valores criados pelo processo
   */
  static async getValuesByProcess(
    processId: string, 
    enumName?: string
  ): Promise<CustomEnumValue[]> {
    try {
      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, retornando array vazio', 'DynamicEnumService.getValuesByProcess');
        return [];
      }

      logger.info(
        `Buscando valores personalizados do processo: ${processId}${enumName ? ` para enum: ${enumName}` : ''}`,
        'DynamicEnumService.getValuesByProcess',
        { processId, enumName }
      );
      
      let query = supabase
        .from('custom_enum_values')
        .select('*')
        .eq('created_by_process_id', processId);
      
      if (enumName) {
        query = query.eq('enum_name', enumName);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Erro ao buscar valores do processo: ${error.message}`);
      }
      
      const values = (data || []).map(record => ({
        id: record.id,
        enumName: record.enum_name,
        enumValue: record.enum_value,
        createdByProcessId: record.created_by_process_id,
        createdAt: new Date(record.created_at)
      }));
      
      logger.success(
        `${values.length} valores personalizados encontrados para o processo`,
        'DynamicEnumService.getValuesByProcess',
        { processId, enumName, count: values.length }
      );
      
      return values;
      
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar valores do processo: ${processId}`,
        error as Error,
        'DynamicEnumService.getValuesByProcess',
        { processId, enumName }
      );
      
      return [];
    }
  }
  
  /**
   * Invalida o cache para um enum específico
   * 
   * @param enumName - Nome do enum para invalidar o cache
   */
  private static invalidateCache(enumName: string): void {
    const cacheKey = this.getCacheKey(enumName);
    this.cache.delete(cacheKey);
    
    logger.info(
      `Cache invalidado para enum: ${enumName}`,
      'DynamicEnumService.invalidateCache',
      { enumName }
    );
  }
  
  /**
   * Limpa todo o cache de enums
   * Útil após operações batch ou para forçar recarregamento completo
   */
  static clearAllCache(): void {
    this.cache.clear();
    logger.info('Todo cache de enums dinâmicos limpo', 'DynamicEnumService.clearAllCache');
  }
  
  /**
   * Obtém estatísticas dos valores personalizados do sistema
   * 
   * @returns Promise<object> - Estatísticas detalhadas dos valores personalizados
   */
  static async getSystemStats(): Promise<{
    totalCustomValues: number;
    byEnum: Record<string, number>;
    recentlyAdded: CustomEnumValue[];
    topProcesses: { processId: string; count: number }[];
  }> {
    try {
      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, retornando estatísticas vazias', 'DynamicEnumService.getSystemStats');
        return {
          totalCustomValues: 0,
          byEnum: {},
          recentlyAdded: [],
          topProcesses: []
        };
      }

      logger.info('Calculando estatísticas do sistema de enums dinâmicos', 'DynamicEnumService.getSystemStats');
      
      // Busca todos os valores personalizados
      const { data, error } = await supabase
        .from('custom_enum_values')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Erro ao calcular estatísticas: ${error.message}`);
      }
      
      const allValues = data || [];
      
      // Calcula valores recentes (última semana)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentValues = allValues
        .filter(record => new Date(record.created_at) >= oneWeekAgo)
        .map(record => ({
          id: record.id,
          enumName: record.enum_name,
          enumValue: record.enum_value,
          createdByProcessId: record.created_by_process_id,
          createdAt: new Date(record.created_at)
        }));
      
      // Agrupa por enum
      const byEnum = allValues.reduce((acc, record) => {
        acc[record.enum_name] = (acc[record.enum_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Top processos que mais criaram valores personalizados
      const processCounts = allValues.reduce((acc, record) => {
        if (record.created_by_process_id) {
          acc[record.created_by_process_id] = (acc[record.created_by_process_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      const topProcesses = Object.entries(processCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([processId, count]) => ({ processId, count }));
      
      const stats = {
        totalCustomValues: allValues.length,
        byEnum,
        recentlyAdded: recentValues,
        topProcesses
      };
      
      logger.success(
        'Estatísticas do sistema de enums calculadas',
        'DynamicEnumService.getSystemStats',
        stats
      );
      
      return stats;
      
    } catch (error) {
      logger.errorWithException(
        'Falha ao calcular estatísticas do sistema de enums',
        error as Error,
        'DynamicEnumService.getSystemStats'
      );
      
      // Retorna estatísticas vazias em caso de erro
      return {
        totalCustomValues: 0,
        byEnum: {},
        recentlyAdded: [],
        topProcesses: []
      };
    }
  }

  /**
   * Cache local para valores predefinidos
   */
  private static predefinedCache = new Map<string, string[]>();

  /**
   * Busca valores predefinidos de um dropdown da tabela dropdown_options
   *
   * @param enumName - Nome do enum/dropdown (ex: 'tipo_decisao')
   * @returns Promise<string[]> - Array de valores predefinidos ordenados
   */
  static async getPredefinedValues(enumName: DynamicEnumType): Promise<string[]> {
    try {
      if (!supabase) {
        logger.warn('Supabase nao configurado, retornando array vazio', 'DynamicEnumService.getPredefinedValues');
        return [];
      }

      const cacheKey = `predefined_${enumName}`;
      if (this.predefinedCache.has(cacheKey)) {
        const cached = this.predefinedCache.get(cacheKey)!;
        logger.info(
          `Valores predefinidos carregados do cache: ${enumName} (${cached.length} valores)`,
          'DynamicEnumService.getPredefinedValues',
          { enumName, count: cached.length, cacheHit: true }
        );
        return cached;
      }

      logger.info(
        `Buscando valores predefinidos da tabela dropdown_options: ${enumName}`,
        'DynamicEnumService.getPredefinedValues',
        { enumName }
      );

      const { data, error } = await supabase
        .from('dropdown_options')
        .select('option_value, display_order')
        .eq('dropdown_name', enumName)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw new Error(`Erro ao buscar valores predefinidos: ${error.message}`);
      }

      const values = (data || []).map(record => record.option_value);

      this.predefinedCache.set(cacheKey, values);

      logger.success(
        `${values.length} valores predefinidos encontrados para ${enumName}`,
        'DynamicEnumService.getPredefinedValues',
        { enumName, count: values.length, values }
      );

      return values;

    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar valores predefinidos para: ${enumName}`,
        error as Error,
        'DynamicEnumService.getPredefinedValues',
        { enumName }
      );

      return [];
    }
  }

  /**
   * Limpa o cache de valores predefinidos
   */
  static clearPredefinedCache(): void {
    this.predefinedCache.clear();
    logger.info('Cache de valores predefinidos limpo', 'DynamicEnumService.clearPredefinedCache');
  }
}

export default DynamicEnumService;