/**
 * Serviço Principal para Tipos de Verba Dinâmicos
 * 
 * Este é o serviço central para gerenciar tipos de verba de forma dinâmica.
 * Responsabilidades claras e bem definidas:
 * 
 * 1. Buscar tipos existentes no sistema
 * 2. Criar novos tipos personalizados  
 * 3. Validar formatos de tipos
 * 4. Gerenciar cache para performance
 * 5. Integração com ambas as tabelas (verbas + custom_enum_values)
 * 
 * IMPORTANTE: Este serviço NÃO faz renomeação - isso fica no RenameService
 */

import { supabase } from '../lib/supabase';
import { TipoVerbaNormalizer } from '../utils/tipoVerbaNormalizer';
import { VERBA_CONSTANTS } from '../types/Verba';
import { logger } from '../utils';

const tipoVerbaChangeListeners = new Set<() => void>();

export const subscribeTipoVerbaChange = (listener: () => void): (() => void) => {
  tipoVerbaChangeListeners.add(listener);
  return () => tipoVerbaChangeListeners.delete(listener);
};

const notifyTipoVerbaChange = () => {
  tipoVerbaChangeListeners.forEach(fn => fn());
};

/**
 * Interface para resultado de operações de criação
 */
export interface CreateTipoResult {
  success: boolean;
  message: string;
  tipo: string;
  wasAlreadyPresent: boolean;
}

/**
 * Interface para estatísticas de uso de um tipo
 */
export interface TipoStats {
  tipoVerba: string;
  totalVerbas: number;
  totalLancamentos: number;
  processosUsando: number;
  primeiraOcorrencia: Date;
  ultimaOcorrencia: Date;
}

/**
 * Classe de serviço para tipos de verba dinâmicos
 * Foco em operações simples e eficientes
 */
export class TipoVerbaService {
  
  /**
   * Cache estático para tipos já carregados
   * Melhora performance evitando consultas repetidas
   */
  private static cache = new Map<string, string[]>();
  
  /**
   * Chave do cache para tipos globais
   */
  private static readonly GLOBAL_CACHE_KEY = 'tipos_globais';
  
  /**
   * Busca todos os tipos de verba distintos existentes no sistema
   * 
   * Esta função combina tipos considerando contexto do processo:
   * 1. Tabela 'verbas' - tipos que estão realmente sendo usados
   * 2. Tabela 'custom_enum_values' - tipos globais E específicos do processo
   * 
   * @param processId - ID do processo (opcional) para contexto específico
   * @returns Promise<string[]> - Array de tipos únicos e ordenados
   */
  static async getTiposDistintos(processId?: string): Promise<string[]> {
    try {
      const cacheKey = processId || this.GLOBAL_CACHE_KEY;
      
      // Verifica cache primeiro
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        return cached;
      }

      // Verifica se Supabase está disponível
      if (!supabase) {
        const tiposBasicos = ['Danos Morais', 'Horas Extras', 'FGTS', 'Férias'];
        this.cache.set(cacheKey, tiposBasicos);
        return tiposBasicos;
      }

      // === Busca todas as fontes de tipos em paralelo ===
      let verbaQuery = supabase
        .from('verbas')
        .select('tipo_verba');

      if (processId) {
        verbaQuery = verbaQuery.eq('process_id', processId);
      }

      const globalCustomQuery = supabase
        .from('custom_enum_values')
        .select('enum_value')
        .eq('enum_name', 'tipo_verba')
        .is('created_by_process_id', null);

      const processCustomQuery = processId
        ? supabase
            .from('custom_enum_values')
            .select('enum_value')
            .eq('enum_name', 'tipo_verba')
            .eq('created_by_process_id', processId)
        : Promise.resolve({ data: [] as { enum_value: string }[], error: null });

      const [
        { data: verbasData, error: verbasError },
        { data: globalCustomData, error: globalCustomError },
        { data: processCustomRaw, error: processCustomError },
      ] = await Promise.all([verbaQuery, globalCustomQuery, processCustomQuery]);

      if (verbasError) {
        throw new Error(`Erro ao buscar tipos das verbas: ${verbasError.message}`);
      }
      if (globalCustomError) {
        throw new Error(`Erro ao buscar tipos globais personalizados: ${globalCustomError.message}`);
      }
      if (processCustomError) {
        throw new Error(`Erro ao buscar tipos personalizados do processo: ${processCustomError.message}`);
      }

      const processCustomData = processCustomRaw || [];

      // === ETAPA 3: Combina e remove duplicatas ===
      const tiposUsados = (verbasData || []).map(item => item.tipo_verba);
      const tiposGlobais = (globalCustomData || []).map(item => item.enum_value);
      const tiposDoProcesso = processCustomData.map(item => item.enum_value);
      
      // Combina arrays e remove duplicatas
      const todosOsTipos = [...tiposUsados, ...tiposGlobais, ...tiposDoProcesso];
      const tiposUnicos = [...new Set(todosOsTipos)]
        .filter(tipo => tipo && tipo.trim()) // Remove valores vazios
        .sort(); // Ordena alfabeticamente

      // Atualiza cache
      this.cache.set(cacheKey, tiposUnicos);

      return tiposUnicos;

    } catch (error) {
      logger.errorWithException(
        'Erro ao buscar tipos distintos',
        error as Error,
        'TipoVerbaService.getTiposDistintos',
        { processId }
      );
      
      // Em caso de erro, retorna tipos básicos
      const tiposBasicos = ['Danos Morais', 'Horas Extras', 'FGTS', 'Férias', '13º Salário'];
      return tiposBasicos;
    }
  }

  /**
   * Cria um novo tipo de verba personalizado no sistema
   * 
   * Este método registra o novo tipo na tabela custom_enum_values
   * para garantir que ele apareça nos dropdowns futuros, mesmo
   * se não houver verbas usando este tipo ainda.
   * 
   * @param tipo - Novo tipo a ser criado
   * @param processId - ID do processo criador (opcional)
   * @returns Promise<CreateTipoResult> - Resultado da operação
   */
  static async criarTipo(tipo: string, processId?: string): Promise<CreateTipoResult> {
    try {
      // Normaliza o tipo usando utilitário especializado
      const tipoNormalizado = TipoVerbaNormalizer.normalize(tipo);

      // Validação usando utilitário especializado
      const validacao = TipoVerbaNormalizer.validate(tipoNormalizado);
      if (!validacao.isValid) {
        return {
          success: false,
          message: validacao.errorMessage || 'Tipo inválido',
          tipo: tipoNormalizado,
          wasAlreadyPresent: false
        };
      }

      // Verifica se Supabase está disponível
      if (!supabase) {
        return {
          success: true,
          message: 'Tipo criado localmente (Supabase offline)',
          tipo: tipoNormalizado,
          wasAlreadyPresent: false
        };
      }

      // Verifica se o tipo já existe
      const tiposExistentes = await this.getTiposDistintos(processId);
      if (tiposExistentes.includes(tipoNormalizado)) {
        return {
          success: true,
          message: `Tipo "${tipoNormalizado}" já existia`,
          tipo: tipoNormalizado,
          wasAlreadyPresent: true
        };
      }

      // Registra o novo tipo na tabela custom_enum_values
      const { error } = await supabase
        .from('custom_enum_values')
        .insert({
          enum_name: 'tipo_verba',
          enum_value: tipoNormalizado,
          created_by_process_id: processId || null
        });

      // Trata erro de duplicata (que pode acontecer em condições de corrida)
      if (error) {
        if (error.code === '23505') {
          // Duplicata - isso não é realmente um erro
          return {
            success: true,
            message: `Tipo "${tipoNormalizado}" já estava registrado`,
            tipo: tipoNormalizado,
            wasAlreadyPresent: true
          };
        }
        
        throw new Error(`Erro ao registrar tipo: ${error.message}`);
      }

      // Limpa cache para forçar recarregamento
      this.limparCache();

      const resultado: CreateTipoResult = {
        success: true,
        message: `Tipo "${tipoNormalizado}" criado com sucesso`,
        tipo: tipoNormalizado,
        wasAlreadyPresent: false
      };

      return resultado;

    } catch (error) {
      logger.errorWithException(
        `Falha ao criar tipo: "${tipo}"`,
        error as Error,
        'TipoVerbaService.criarTipo',
        { tipo, processId }
      );

      return {
        success: false,
        message: `Erro ao criar tipo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        tipo: TipoVerbaNormalizer.normalize(tipo),
        wasAlreadyPresent: false
      };
    }
  }

  /**
   * Valida se um tipo de verba está em formato válido
   * 
   * Usa o TipoVerbaNormalizer para validação consistente
   * 
   * @param tipo - Tipo a ser validado
   * @returns Objeto com resultado da validação
   */
  static validarTipo(tipo: string): { isValid: boolean; errorMessage?: string } {
    const resultado = TipoVerbaNormalizer.validate(tipo);
    return {
      isValid: resultado.isValid,
      errorMessage: resultado.errorMessage
    };
  }

  /**
   * Normaliza um tipo de verba usando regras padronizadas
   * 
   * @param tipo - Tipo a ser normalizado
   * @returns Tipo normalizado
   */
  static normalizarTipo(tipo: string): string {
    return TipoVerbaNormalizer.normalize(tipo);
  }

  /**
   * Obtém estatísticas de uso de um tipo específico
   * 
   * @param tipo - Tipo para calcular estatísticas
   * @returns Promise<TipoStats> - Estatísticas do tipo
   */
  static async obterEstatisticas(tipo: string): Promise<TipoStats> {
    try {
      const tipoNormalizado = TipoVerbaNormalizer.normalize(tipo);

      // Verifica se Supabase está disponível
      if (!supabase) {
        return this.criarEstatisticasVazias(tipoNormalizado);
      }

      // Busca verbas que usam este tipo
      const { data: verbas, error: verbasError } = await supabase
        .from('verbas')
        .select(`
          id, 
          process_id, 
          created_at, 
          updated_at,
          verba_lancamentos(id, created_at, updated_at)
        `)
        .eq('tipo_verba', tipoNormalizado);

      if (verbasError) {
        throw new Error(`Erro ao buscar verbas: ${verbasError.message}`);
      }

      type VerbaComLancamentos = {
        id: string;
        process_id: string;
        created_at: string;
        updated_at: string;
        verba_lancamentos: Array<{ id: string; created_at: string; updated_at: string }> | null;
      };

      const verbasEncontradas = (verbas || []) as VerbaComLancamentos[];
      const processosUnicos = new Set(verbasEncontradas.map(v => v.process_id));

      // Conta total de lançamentos
      const totalLancamentos = verbasEncontradas.reduce((total, verba) => {
        return total + (verba.verba_lancamentos?.length || 0);
      }, 0);

      // Calcula datas das verbas
      const datasCriacao = verbasEncontradas.map(v => new Date(v.created_at));
      const datasAtualizacao = verbasEncontradas.map(v => new Date(v.updated_at));

      // Calcula datas dos lançamentos
      const datasLancamentos: Date[] = [];
      verbasEncontradas.forEach((verba) => {
        if (verba.verba_lancamentos) {
          verba.verba_lancamentos.forEach((lancamento) => {
            datasLancamentos.push(new Date(lancamento.created_at));
            datasLancamentos.push(new Date(lancamento.updated_at));
          });
        }
      });
      
      // Combina todas as datas para encontrar primeira e última ocorrência
      const todasAsDatas = [...datasCriacao, ...datasAtualizacao, ...datasLancamentos];
      
      const agora = new Date();
      const primeiraOcorrencia = todasAsDatas.length > 0 
        ? new Date(Math.min(...todasAsDatas.map(d => d.getTime())))
        : agora;
      const ultimaOcorrencia = todasAsDatas.length > 0
        ? new Date(Math.max(...todasAsDatas.map(d => d.getTime())))
        : agora;

      const estatisticas: TipoStats = {
        tipoVerba: tipoNormalizado,
        totalVerbas: verbasEncontradas.length,
        totalLancamentos,
        processosUsando: processosUnicos.size,
        primeiraOcorrencia,
        ultimaOcorrencia
      };

      return estatisticas;

    } catch (error) {
      logger.errorWithException(
        `Erro ao calcular estatísticas para: "${tipo}"`,
        error as Error,
        'TipoVerbaService.obterEstatisticas',
        { tipo }
      );

      return this.criarEstatisticasVazias(TipoVerbaNormalizer.normalize(tipo));
    }
  }

  /**
   * Cria objeto de estatísticas vazio
   * Usado quando não há dados ou em caso de erro
   * 
   * @param tipo - Nome do tipo
   * @returns Estatísticas zeradas
   */
  private static criarEstatisticasVazias(tipo: string): TipoStats {
    const agora = new Date();
    return {
      tipoVerba: tipo,
      totalVerbas: 0,
      totalLancamentos: 0,
      processosUsando: 0,
      primeiraOcorrencia: agora,
      ultimaOcorrencia: agora
    };
  }

  /**
   * Força recarregamento dos tipos invalidando o cache
   * 
   * @param processId - ID do processo (opcional) para cache específico
   */
  static forcarRecarregamento(processId?: string): void {
    const cacheKey = processId || this.GLOBAL_CACHE_KEY;
    this.cache.delete(cacheKey);
  }

  /**
   * Limpa todo o cache de tipos
   */
  static limparCache(): void {
    this.cache.clear();
    notifyTipoVerbaChange();
  }

  /**
   * Remove um tipo personalizado da tabela custom_enum_values
   * Bloqueia exclusão se houver verbas/lançamentos vinculados
   *
   * @param tipo - Tipo a ser removido
   * @param processId - ID do processo (opcional)
   * @returns Promise com sucesso/erro
   */
  static async removerTipo(tipo: string, processId?: string): Promise<{ success: boolean; message: string; totalLancamentos?: number }> {
    try {
      const tipoNormalizado = TipoVerbaNormalizer.normalize(tipo);

      if (!supabase) {
        return { success: false, message: 'Supabase não disponível' };
      }

      let verbasQuery = supabase
        .from('verbas')
        .select('id, verba_lancamentos(id)')
        .eq('tipo_verba', tipoNormalizado);

      if (processId) {
        verbasQuery = verbasQuery.eq('process_id', processId);
      }

      const { data: verbas, error: verbasError } = await verbasQuery;

      if (verbasError) {
        throw new Error(`Erro ao verificar uso: ${verbasError.message}`);
      }

      type VerbaComLancamentos = { id: string; verba_lancamentos: Array<{ id: string }> | null };
      const verbasEncontradas = (verbas || []) as VerbaComLancamentos[];
      const totalLancamentos = verbasEncontradas.reduce((acc, v) => acc + (v.verba_lancamentos?.length || 0), 0);

      if (totalLancamentos > 0) {
        return {
          success: false,
          message: `Este tipo possui ${totalLancamentos} lançamento${totalLancamentos > 1 ? 's' : ''} vinculado${totalLancamentos > 1 ? 's' : ''}. Remova os lançamentos antes de excluir o tipo.`,
          totalLancamentos
        };
      }

      const { error: deleteError } = await supabase
        .from('custom_enum_values')
        .delete()
        .eq('enum_name', 'tipo_verba')
        .eq('enum_value', tipoNormalizado);

      if (deleteError) {
        throw new Error(`Erro ao remover tipo: ${deleteError.message}`);
      }

      this.limparCache();

      return { success: true, message: `Tipo "${tipoNormalizado}" removido com sucesso`, totalLancamentos: 0 };

    } catch (error) {
      logger.errorWithException(
        `Falha ao remover tipo: "${tipo}"`,
        error as Error,
        'TipoVerbaService.removerTipo',
        { tipo, processId }
      );
      return {
        success: false,
        message: `Erro ao remover tipo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Verifica se um tipo está sendo usado no sistema
   *
   * @param tipo - Tipo a ser verificado
   * @param processId - ID do processo (opcional) para escopo limitado
   * @returns Promise<boolean> - true se está sendo usado
   */
  static async estaEmUso(tipo: string, processId?: string): Promise<boolean> {
    try {
      const tipoNormalizado = TipoVerbaNormalizer.normalize(tipo);

      if (!supabase) return false;

      let query = supabase
        .from('verbas')
        .select('id')
        .eq('tipo_verba', tipoNormalizado)
        .limit(1);

      if (processId) {
        query = query.eq('process_id', processId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao verificar uso: ${error.message}`);
      }

      const estaUsado = (data || []).length > 0;

      return estaUsado;

    } catch (error) {
      logger.errorWithException(
        `Erro ao verificar uso do tipo: "${tipo}"`,
        error as Error,
        'TipoVerbaService.estaEmUso',
        { tipo, processId }
      );
      return false;
    }
  }
}

export default TipoVerbaService;