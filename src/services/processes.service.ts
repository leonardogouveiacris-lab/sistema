/**
 * Serviço para operações CRUD da entidade Processes
 * 
 * Este serviço encapsula toda a lógica de interação com a tabela 'processes'
 * do Supabase, fornecendo uma interface limpa para as operações de banco de dados.
 * 
 * Funcionalidades:
 * - CRUD completo (Create, Read, Update, Delete)
 * - Validação de dados
 * - Tratamento de erros
 * - Conversão entre formatos da aplicação e do banco
 * - Logging de operações
 */

import { supabase } from '../lib/supabase.tsx';
import { ProcessRecord, Database } from '../types/database';
import { Process, NewProcess } from '../types/Process';
import { logger } from '../utils';
import { SystemError, ErrorType } from '../utils/errorHandler';

/**
 * Tipo para inserção na tabela processes
 */
type ProcessInsert = Database['public']['Tables']['processes']['Insert'];

/**
 * Tipo para atualização na tabela processes
 */
type ProcessUpdate = Database['public']['Tables']['processes']['Update'];

/**
 * Classe de serviço para gerenciar operações de processos
 * 
 * Esta classe fornece métodos para todas as operações relacionadas
 * à entidade Process, mantendo a separação entre lógica de negócio
 * e persistência de dados.
 */
export class ProcessesService {
  
  /**
   * Converte um registro do banco (ProcessRecord) para o tipo da aplicação (Process)
   * 
   * Esta função é responsável por fazer a conversão entre os formatos
   * utilizados no banco de dados (snake_case, strings ISO para datas)
   * e os formatos utilizados na aplicação (camelCase, objetos Date)
   * 
   * @param record - Registro do banco de dados
   * @returns Objeto Process formatado para a aplicação
   */
  private static recordToProcess(record: ProcessRecord): Process {
    return {
      id: record.id,
      numeroProcesso: record.numero_processo,
      reclamante: record.reclamante,
      reclamada: record.reclamada,
      observacoesGerais: record.observacoes_gerais || '',
      statusVerbas: record.status_verbas || 'pendente',
      dataCriacao: new Date(record.created_at),
      dataAtualizacao: new Date(record.updated_at)
    };
  }

  /**
   * Converte um NewProcess para o formato de inserção no banco
   * 
   * @param process - Dados do novo processo
   * @returns Objeto formatado para inserção no banco
   */
  private static processToInsert(process: NewProcess): ProcessInsert {
    return {
      numero_processo: process.numeroProcesso,
      reclamante: process.reclamante,
      reclamada: process.reclamada,
      observacoes_gerais: process.observacoesGerais || null
    };
  }

  /**
   * Converte dados de atualização para o formato do banco
   * 
   * @param updates - Dados parciais para atualização
   * @returns Objeto formatado para atualização no banco
   */
  private static updatesToRecord(updates: Partial<NewProcess>): ProcessUpdate {
    const record: ProcessUpdate = {};
    
    if (updates.numeroProcesso !== undefined) {
      record.numero_processo = updates.numeroProcesso;
    }
    
    if (updates.reclamante !== undefined) {
      record.reclamante = updates.reclamante;
    }
    
    if (updates.reclamada !== undefined) {
      record.reclamada = updates.reclamada;
    }
    
    if (updates.observacoesGerais !== undefined) {
      record.observacoes_gerais = updates.observacoesGerais || null;
    }
    
    return record;
  }

  /**
   * Busca todos os processos ordenados por data de atualização (mais recentes primeiro)
   * 
   * @returns Promise<Process[]> - Lista de todos os processos
   * @throws Error se ocorrer problema na consulta
   */
  static async getAll(): Promise<Process[]> {
    try {
      logger.info('Buscando todos os processos...', 'ProcessesService.getAll');

      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, retornando array vazio', 'ProcessesService.getAll');
        return [];
      }

      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar processos: ${error.message}`);
      }

      const processes = (data || []).map(this.recordToProcess);

      logger.success(
        `${processes.length} processos carregados com sucesso`,
        'ProcessesService.getAll',
        { count: processes.length }
      );

      return processes;
    } catch (error) {
      logger.errorWithException(
        'Falha ao carregar processos do banco de dados',
        error as Error,
        'ProcessesService.getAll'
      );
      throw error;
    }
  }

  /**
   * Busca um processo específico por ID
   * 
   * @param id - UUID do processo
   * @returns Promise<Process | null> - Processo encontrado ou null
   * @throws Error se ocorrer problema na consulta
   */
  static async getById(id: string): Promise<Process | null> {
    try {
      logger.info(`Buscando processo por ID: ${id}`, 'ProcessesService.getById');

      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nenhum registro encontrado
          logger.warn(`Processo não encontrado: ${id}`, 'ProcessesService.getById');
          return null;
        }
        throw new Error(`Erro ao buscar processo: ${error.message}`);
      }

      const process = this.recordToProcess(data);

      logger.success(
        `Processo encontrado: ${process.numeroProcesso}`,
        'ProcessesService.getById',
        { id, numeroProcesso: process.numeroProcesso }
      );

      return process;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar processo por ID: ${id}`,
        error as Error,
        'ProcessesService.getById'
      );
      throw error;
    }
  }

  /**
   * Cria um novo processo
   * 
   * @param newProcess - Dados do novo processo
   * @returns Promise<Process> - Processo criado com ID e timestamps
   * @throws Error se ocorrer problema na criação
   */
  static async create(newProcess: NewProcess): Promise<Process> {
    try {
      logger.info(
        `Criando novo processo: ${newProcess.numeroProcesso}`,
        'ProcessesService.create',
        { numeroProcesso: newProcess.numeroProcesso, reclamante: newProcess.reclamante }
      );

      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      const insertData = this.processToInsert(newProcess);

      const { data, error } = await supabase
        .from('processes')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // Tratamento específico para erro de duplicata
        if (error.code === '23505' && error.message.includes('numero_processo')) {
          throw new SystemError(
            `Processo com número ${newProcess.numeroProcesso} já existe`,
            ErrorType.BUSINESS,
            '23505',
            { numeroProcesso: newProcess.numeroProcesso },
            'ProcessesService.create'
          );
        }
        throw new SystemError(
          `Erro ao criar processo: ${error.message}`,
          ErrorType.SYSTEM,
          error.code,
          error,
          'ProcessesService.create'
        );
      }

      const createdProcess = this.recordToProcess(data);

      logger.success(
        `Processo criado com sucesso: ${createdProcess.numeroProcesso}`,
        'ProcessesService.create',
        {
          id: createdProcess.id,
          numeroProcesso: createdProcess.numeroProcesso,
          reclamante: createdProcess.reclamante
        }
      );

      return createdProcess;
    } catch (error) {
      logger.errorWithException(
        `Falha ao criar processo: ${newProcess.numeroProcesso}`,
        error as Error,
        'ProcessesService.create',
        { newProcess }
      );
      throw error;
    }
  }

  /**
   * Atualiza um processo existente
   * 
   * @param id - UUID do processo a ser atualizado
   * @param updates - Dados parciais para atualização
   * @returns Promise<Process> - Processo atualizado
   * @throws Error se processo não existir ou ocorrer problema na atualização
   */
  static async update(id: string, updates: Partial<NewProcess>): Promise<Process> {
    try {
      logger.info(
        `Atualizando processo: ${id}`,
        'ProcessesService.update',
        { id, updates: Object.keys(updates) }
      );

      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      const updateData = this.updatesToRecord(updates);

      const { data, error } = await supabase
        .from('processes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new SystemError(
            `Processo com ID ${id} não encontrado`,
            ErrorType.BUSINESS,
            'PGRST116',
            { id },
            'ProcessesService.update'
          );
        }
        // Tratamento específico para erro de duplicata
        if (error.code === '23505' && error.message.includes('numero_processo')) {
          throw new SystemError(
            `Processo com número ${updates.numeroProcesso} já existe`,
            ErrorType.BUSINESS,
            '23505',
            { numeroProcesso: updates.numeroProcesso },
            'ProcessesService.update'
          );
        }
        throw new SystemError(
          `Erro ao atualizar processo: ${error.message}`,
          ErrorType.SYSTEM,
          error.code,
          error,
          'ProcessesService.update'
        );
      }

      const updatedProcess = this.recordToProcess(data);

      logger.success(
        `Processo atualizado com sucesso: ${updatedProcess.numeroProcesso}`,
        'ProcessesService.update',
        {
          id: updatedProcess.id,
          numeroProcesso: updatedProcess.numeroProcesso,
          changedFields: Object.keys(updates)
        }
      );

      return updatedProcess;
    } catch (error) {
      logger.errorWithException(
        `Falha ao atualizar processo: ${id}`,
        error as Error,
        'ProcessesService.update',
        { id, updates }
      );
      throw error;
    }
  }

  /**
   * Remove um processo por ID
   * 
   * ATENÇÃO: Esta operação também removerá automaticamente todas as decisões
   * e verbas vinculadas devido às constraints de chave estrangeira (CASCADE)
   * NOVO: Também remove tipos de verba personalizados criados por este processo
   * 
   * @param id - UUID do processo a ser removido
   * @returns Promise<boolean> - true se removido com sucesso
   * @throws Error se processo não existir ou ocorrer problema na remoção
   */
  static async delete(id: string): Promise<boolean> {
    try {
      logger.info(`Removendo processo: ${id}`, 'ProcessesService.delete');

      // Primeiro, busca o processo para logging
      const existingProcess = await this.getById(id);
      if (!existingProcess) {
        throw new Error(`Processo com ID ${id} não encontrado`);
      }

      // ETAPA 1: Remove tipos de verba personalizados criados por este processo
      logger.info(
        `Limpando tipos personalizados do processo: ${existingProcess.numeroProcesso}`,
        'ProcessesService.delete - cleanup custom types',
        { processId: id }
      );

      if (supabase) {
        const { data: customTypes, error: selectError } = await supabase
          .from('custom_enum_values')
          .select('enum_value')
          .eq('created_by_process_id', id);

        if (selectError) {
          logger.warn(
            `Erro ao buscar tipos personalizados do processo: ${selectError.message}`,
            'ProcessesService.delete - cleanup custom types',
            { processId: id }
          );
        } else {
          const tiposParaRemover = (customTypes || []).map(t => t.enum_value);
          
          if (tiposParaRemover.length > 0) {
            const { error: deleteCustomError } = await supabase
              .from('custom_enum_values')
              .delete()
              .eq('created_by_process_id', id);

            if (deleteCustomError) {
              logger.warn(
                `Erro ao remover tipos personalizados: ${deleteCustomError.message}`,
                'ProcessesService.delete - cleanup custom types',
                { processId: id, tipos: tiposParaRemover }
              );
            } else {
              logger.success(
                `${tiposParaRemover.length} tipos personalizados removidos`,
                'ProcessesService.delete - cleanup custom types',
                { processId: id, tiposRemovidos: tiposParaRemover }
              );
            }
          } else {
            logger.info(
              'Nenhum tipo personalizado encontrado para limpeza',
              'ProcessesService.delete - cleanup custom types',
              { processId: id }
            );
          }
        }
      }

      // ETAPA 2: Remove o processo (CASCADE remove decisões e verbas)
      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      const { error } = await supabase
        .from('processes')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao remover processo: ${error.message}`);
      }

      logger.success(
        `Processo e tipos personalizados removidos com sucesso: ${existingProcess.numeroProcesso}`,
        'ProcessesService.delete',
        {
          id,
          numeroProcesso: existingProcess.numeroProcesso,
          reclamante: existingProcess.reclamante
        }
      );

      return true;
    } catch (error) {
      logger.errorWithException(
        `Falha ao remover processo: ${id}`,
        error as Error,
        'ProcessesService.delete',
        { id }
      );
      throw error;
    }
  }

  /**
   * Busca processos por termo de pesquisa
   * 
   * Realiza busca nos campos: numero_processo, reclamante, reclamada e observacoes_gerais
   * 
   * @param searchTerm - Termo de busca
   * @returns Promise<Process[]> - Lista de processos que correspondem à busca
   * @throws Error se ocorrer problema na consulta
   */
  static async search(searchTerm: string): Promise<Process[]> {
    try {
      if (!searchTerm.trim()) {
        return await this.getAll();
      }

      logger.info(
        `Pesquisando processos por: "${searchTerm}"`,
        'ProcessesService.search',
        { searchTerm }
      );

      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      const sanitized = searchTerm.replace(/[%_,().*]/g, '');
      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .or(`numero_processo.ilike.%${sanitized}%,reclamante.ilike.%${sanitized}%,reclamada.ilike.%${sanitized}%,observacoes_gerais.ilike.%${sanitized}%`)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro na pesquisa de processos: ${error.message}`);
      }

      const processes = (data || []).map(this.recordToProcess);

      logger.success(
        `Pesquisa concluída: ${processes.length} processos encontrados`,
        'ProcessesService.search',
        { searchTerm, count: processes.length }
      );

      return processes;
    } catch (error) {
      logger.errorWithException(
        `Falha na pesquisa de processos: "${searchTerm}"`,
        error as Error,
        'ProcessesService.search',
        { searchTerm }
      );
      throw error;
    }
  }

  /**
   * Verifica se um número de processo já existe
   * 
   * @param numeroProcesso - Número do processo a ser verificado
   * @param excludeId - ID a ser excluído da verificação (útil para atualizações)
   * @returns Promise<boolean> - true se o número já existe
   * @throws Error se ocorrer problema na consulta
   */
  static async exists(numeroProcesso: string, excludeId?: string): Promise<boolean> {
    try {
      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      let query = supabase
        .from('processes')
        .select('id')
        .eq('numero_processo', numeroProcesso);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao verificar existência do processo: ${error.message}`);
      }

      return (data || []).length > 0;
    } catch (error) {
      logger.errorWithException(
        `Falha ao verificar existência do processo: ${numeroProcesso}`,
        error as Error,
        'ProcessesService.exists',
        { numeroProcesso, excludeId }
      );
      throw error;
    }
  }

  /**
   * Obtém estatísticas dos processos
   * 
   * @returns Promise<object> - Objeto com estatísticas dos processos
   * @throws Error se ocorrer problema na consulta
   */
  static async getStats(): Promise<{
    total: number;
    recentes: number;
    porPeriodo: {
      ultima_semana: number;
      ultimo_mes: number;
      ultimo_ano: number;
    };
  }> {
    try {
      logger.info('Calculando estatísticas dos processos...', 'ProcessesService.getStats');

      // Data atual e períodos
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

      if (!supabase) {
        throw new Error('Supabase não configurado');
      }

      const [totalResult, weekResult, monthResult, yearResult] = await Promise.all([
        supabase.from('processes').select('*', { count: 'exact', head: true }),
        supabase.from('processes').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
        supabase.from('processes').select('*', { count: 'exact', head: true }).gte('created_at', oneMonthAgo),
        supabase.from('processes').select('*', { count: 'exact', head: true }).gte('created_at', oneYearAgo)
      ]);

      if (totalResult.error) throw totalResult.error;
      if (weekResult.error) throw weekResult.error;
      if (monthResult.error) throw monthResult.error;
      if (yearResult.error) throw yearResult.error;

      const total = totalResult.count;
      const ultima_semana = weekResult.count;
      const ultimo_mes = monthResult.count;
      const ultimo_ano = yearResult.count;

      const stats = {
        total: total || 0,
        recentes: ultima_semana || 0,
        porPeriodo: {
          ultima_semana: ultima_semana || 0,
          ultimo_mes: ultimo_mes || 0,
          ultimo_ano: ultimo_ano || 0
        }
      };

      logger.success(
        'Estatísticas calculadas com sucesso',
        'ProcessesService.getStats',
        stats
      );

      return stats;
    } catch (error) {
      logger.errorWithException(
        'Falha ao calcular estatísticas dos processos',
        error as Error,
        'ProcessesService.getStats'
      );
      throw error;
    }
  }
}

export default ProcessesService;