/**
 * Serviço para operações CRUD da entidade Decisions
 * 
 * Este serviço encapsula toda a lógica de interação com a tabela 'decisions'
 * do Supabase, fornecendo uma interface limpa para as operações de banco de dados.
 * 
 * Funcionalidades:
 * - CRUD completo (Create, Read, Update, Delete)
 * - Validação de dados e relacionamentos
 * - Tratamento de erros específicos
 * - Conversão entre formatos da aplicação e do banco
 * - Logging detalhado de operações
 * - Consultas otimizadas por processo
 */

import { supabase } from '../lib/supabase.tsx';
import { DecisionRecord, Database } from '../types/database';
import { Decision, NewDecision } from '../types/Decision';
import { logger } from '../utils';

/**
 * Tipo para inserção na tabela decisions
 */
type DecisionInsert = Database['public']['Tables']['decisions']['Insert'];

/**
 * Tipo para atualização na tabela decisions
 */
type DecisionUpdate = Database['public']['Tables']['decisions']['Update'];

/**
 * Classe de serviço para gerenciar operações de decisões judiciais
 * 
 * Esta classe fornece métodos para todas as operações relacionadas
 * à entidade Decision, garantindo a integridade referencial com
 * a tabela de processos e mantendo a consistência dos dados.
 */
export class DecisionsService {

  /**
   * Converte um registro do banco (DecisionRecord) para o tipo da aplicação (Decision)
   * 
   * Esta função é responsável por fazer a conversão entre os formatos
   * utilizados no banco de dados (snake_case, strings ISO para datas)
   * e os formatos utilizados na aplicação (camelCase, objetos Date)
   * 
   * @param record - Registro do banco de dados
   * @returns Objeto Decision formatado para a aplicação
   */
  private static recordToDecision(record: DecisionRecord): Decision {
    return {
      id: record.id,
      processId: record.process_id,
      tipoDecisao: record.tipo_decisao,
      idDecisao: record.id_decisao,
      situacao: record.situacao,
      observacoes: record.observacoes || '',
      paginaVinculada: record.pagina_vinculada ?? undefined,
      dataCriacao: new Date(record.created_at),
      dataAtualizacao: new Date(record.updated_at)
    };
  }

  /**
   * Converte um NewDecision para o formato de inserção no banco
   *
   * @param decision - Dados da nova decisão
   * @returns Objeto formatado para inserção no banco
   */
  private static decisionToInsert(decision: NewDecision): DecisionInsert {
    return {
      process_id: decision.processId,
      tipo_decisao: decision.tipoDecisao,
      id_decisao: decision.idDecisao,
      situacao: decision.situacao,
      observacoes: decision.observacoes || null,
      pagina_vinculada: decision.paginaVinculada || null
    };
  }

  /**
   * Converte dados de atualização para o formato do banco
   *
   * @param updates - Dados parciais para atualização
   * @returns Objeto formatado para atualização no banco
   */
  private static updatesToRecord(updates: Partial<NewDecision>): DecisionUpdate {
    const record: DecisionUpdate = {};

    if (updates.tipoDecisao !== undefined) {
      record.tipo_decisao = updates.tipoDecisao;
    }

    if (updates.idDecisao !== undefined) {
      record.id_decisao = updates.idDecisao;
    }

    if (updates.situacao !== undefined) {
      record.situacao = updates.situacao;
    }

    if (updates.observacoes !== undefined) {
      record.observacoes = updates.observacoes || null;
    }

    if (updates.paginaVinculada !== undefined) {
      record.pagina_vinculada = updates.paginaVinculada || null;
    }

    return record;
  }

  /**
   * Busca todas as decisões ordenadas por data de atualização (mais recentes primeiro)
   * 
   * @returns Promise<Decision[]> - Lista de todas as decisões
   * @throws Error se ocorrer problema na consulta
   */
  static async getAll(): Promise<Decision[]> {
    try {
      logger.info('Buscando todas as decisões...', 'DecisionsService.getAll');

      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, retornando array vazio', 'DecisionsService.getAll');
        return [];
      }

      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar decisões: ${error.message}`);
      }

      const decisions = (data || []).map(this.recordToDecision);

      logger.success(
        `${decisions.length} decisões carregadas com sucesso`,
        'DecisionsService.getAll',
        { count: decisions.length }
      );

      return decisions;
    } catch (error) {
      // Trata especificamente erros de conectividade
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        logger.warn(
          'Falha de conectividade com Supabase ao buscar decisões',
          'DecisionsService.getAll'
        );
        throw new Error('Erro de conectividade com Supabase. Verifique suas credenciais e conexão de rede.');
      }
      
      logger.errorWithException(
        'Falha ao carregar decisões do banco de dados',
        error as Error,
        'DecisionsService.getAll'
      );
      throw error;
    }
  }

  /**
   * Busca uma decisão específica por ID
   * 
   * @param id - UUID da decisão
   * @returns Promise<Decision | null> - Decisão encontrada ou null
   * @throws Error se ocorrer problema na consulta
   */
  static async getById(id: string): Promise<Decision | null> {
    try {
      logger.info(`Buscando decisão por ID: ${id}`, 'DecisionsService.getById');

      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nenhum registro encontrado
          logger.warn(`Decisão não encontrada: ${id}`, 'DecisionsService.getById');
          return null;
        }
        throw new Error(`Erro ao buscar decisão: ${error.message}`);
      }

      const decision = this.recordToDecision(data);

      logger.success(
        `Decisão encontrada: ${decision.idDecisao}`,
        'DecisionsService.getById',
        { id, idDecisao: decision.idDecisao, tipoDecisao: decision.tipoDecisao }
      );

      return decision;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar decisão por ID: ${id}`,
        error as Error,
        'DecisionsService.getById'
      );
      throw error;
    }
  }

  /**
   * Busca todas as decisões de um processo específico
   * 
   * @param processId - UUID do processo
   * @returns Promise<Decision[]> - Lista de decisões do processo
   * @throws Error se ocorrer problema na consulta
   */
  static async getByProcessId(processId: string): Promise<Decision[]> {
    try {
      logger.info(
        `Buscando decisões do processo: ${processId}`,
        'DecisionsService.getByProcessId',
        { processId }
      );

      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar decisões do processo: ${error.message}`);
      }

      const decisions = (data || []).map(this.recordToDecision);

      logger.success(
        `${decisions.length} decisões encontradas para o processo`,
        'DecisionsService.getByProcessId',
        { processId, count: decisions.length }
      );

      return decisions;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar decisões do processo: ${processId}`,
        error as Error,
        'DecisionsService.getByProcessId',
        { processId }
      );
      throw error;
    }
  }

  /**
   * Cria uma nova decisão
   * 
   * @param newDecision - Dados da nova decisão
   * @returns Promise<Decision> - Decisão criada com ID e timestamps
   * @throws Error se ocorrer problema na criação
   */
  static async create(newDecision: NewDecision): Promise<Decision> {
    try {
      logger.info(
        `Criando nova decisão: ${newDecision.idDecisao} (${newDecision.tipoDecisao})`,
        'DecisionsService.create',
        {
          idDecisao: newDecision.idDecisao,
          tipoDecisao: newDecision.tipoDecisao,
          processId: newDecision.processId
        }
      );

      const insertData = this.decisionToInsert(newDecision);

      const { data, error } = await supabase
        .from('decisions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // Tratamento específico para erro de duplicata
        if (error.code === '23505' && error.message.includes('decisions_unique_per_process')) {
          throw new Error(`Decisão com ID ${newDecision.idDecisao} já existe neste processo`);
        }
        
        // Tratamento específico para erro de chave estrangeira (processo não existe)
        if (error.code === '23503' && error.message.includes('process_id')) {
          throw new Error(`Processo com ID ${newDecision.processId} não encontrado`);
        }
        
        throw new Error(`Erro ao criar decisão: ${error.message}`);
      }

      const createdDecision = this.recordToDecision(data);

      logger.success(
        `Decisão criada com sucesso: ${createdDecision.idDecisao}`,
        'DecisionsService.create',
        {
          id: createdDecision.id,
          idDecisao: createdDecision.idDecisao,
          tipoDecisao: createdDecision.tipoDecisao,
          processId: createdDecision.processId
        }
      );

      return createdDecision;
    } catch (error) {
      logger.errorWithException(
        `Falha ao criar decisão: ${newDecision.idDecisao}`,
        error as Error,
        'DecisionsService.create',
        { newDecision }
      );
      throw error;
    }
  }

  /**
   * Atualiza uma decisão existente
   * 
   * @param id - UUID da decisão a ser atualizada
   * @param updates - Dados parciais para atualização
   * @returns Promise<Decision> - Decisão atualizada
   * @throws Error se decisão não existir ou ocorrer problema na atualização
   */
  static async update(id: string, updates: Partial<NewDecision>): Promise<Decision> {
    try {
      logger.info(
        `Atualizando decisão: ${id}`,
        'DecisionsService.update',
        { id, updates: Object.keys(updates) }
      );

      const updateData = this.updatesToRecord(updates);

      const { data, error } = await supabase
        .from('decisions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error(`Decisão com ID ${id} não encontrada`);
        }
        
        // Tratamento específico para erro de duplicata
        if (error.code === '23505' && error.message.includes('decisions_unique_per_process')) {
          throw new Error(`Decisão com ID ${updates.idDecisao} já existe neste processo`);
        }
        
        throw new Error(`Erro ao atualizar decisão: ${error.message}`);
      }

      const updatedDecision = this.recordToDecision(data);

      logger.success(
        `Decisão atualizada com sucesso: ${updatedDecision.idDecisao}`,
        'DecisionsService.update',
        {
          id: updatedDecision.id,
          idDecisao: updatedDecision.idDecisao,
          changedFields: Object.keys(updates)
        }
      );

      return updatedDecision;
    } catch (error) {
      logger.errorWithException(
        `Falha ao atualizar decisão: ${id}`,
        error as Error,
        'DecisionsService.update',
        { id, updates }
      );
      throw error;
    }
  }

  /**
   * Remove uma decisão por ID
   * 
   * ATENÇÃO: Esta operação também removerá automaticamente todos os lançamentos
   * de verbas que referenciam esta decisão devido às constraints de integridade
   * 
   * @param id - UUID da decisão a ser removida
   * @returns Promise<boolean> - true se removida com sucesso
   * @throws Error se decisão não existir ou ocorrer problema na remoção
   */
  static async delete(id: string): Promise<boolean> {
    try {
      logger.info(`Removendo decisão: ${id}`, 'DecisionsService.delete');

      // Primeiro, busca a decisão para logging
      const existingDecision = await this.getById(id);
      if (!existingDecision) {
        throw new Error(`Decisão com ID ${id} não encontrada`);
      }

      const { error } = await supabase
        .from('decisions')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao remover decisão: ${error.message}`);
      }

      logger.success(
        `Decisão removida com sucesso: ${existingDecision.idDecisao}`,
        'DecisionsService.delete',
        {
          id,
          idDecisao: existingDecision.idDecisao,
          tipoDecisao: existingDecision.tipoDecisao,
          processId: existingDecision.processId
        }
      );

      return true;
    } catch (error) {
      logger.errorWithException(
        `Falha ao remover decisão: ${id}`,
        error as Error,
        'DecisionsService.delete',
        { id }
      );
      throw error;
    }
  }

  /**
   * Busca decisões por termo de pesquisa
   * 
   * Realiza busca nos campos: id_decisao, tipo_decisao, situacao e observacoes
   * 
   * @param searchTerm - Termo de busca
   * @param processId - ID do processo (opcional) para filtrar por processo específico
   * @returns Promise<Decision[]> - Lista de decisões que correspondem à busca
   * @throws Error se ocorrer problema na consulta
   */
  static async search(searchTerm: string, processId?: string): Promise<Decision[]> {
    try {
      if (!searchTerm.trim()) {
        return processId ? await this.getByProcessId(processId) : await this.getAll();
      }

      logger.info(
        `Pesquisando decisões por: "${searchTerm}"${processId ? ` no processo: ${processId}` : ''}`,
        'DecisionsService.search',
        { searchTerm, processId }
      );

      let query = supabase
        .from('decisions')
        .select('*')
        .or(`id_decisao.ilike.%${searchTerm}%,tipo_decisao.ilike.%${searchTerm}%,situacao.ilike.%${searchTerm}%,observacoes.ilike.%${searchTerm}%`);

      if (processId) {
        query = query.eq('process_id', processId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro na pesquisa de decisões: ${error.message}`);
      }

      const decisions = (data || []).map(this.recordToDecision);

      logger.success(
        `Pesquisa concluída: ${decisions.length} decisões encontradas`,
        'DecisionsService.search',
        { searchTerm, processId, count: decisions.length }
      );

      return decisions;
    } catch (error) {
      logger.errorWithException(
        `Falha na pesquisa de decisões: "${searchTerm}"`,
        error as Error,
        'DecisionsService.search',
        { searchTerm, processId }
      );
      throw error;
    }
  }

  /**
   * Verifica se um ID de decisão já existe em um processo
   * 
   * @param idDecisao - ID da decisão a ser verificado
   * @param processId - ID do processo
   * @param excludeId - ID a ser excluído da verificação (útil para atualizações)
   * @returns Promise<boolean> - true se o ID já existe no processo
   * @throws Error se ocorrer problema na consulta
   */
  static async exists(idDecisao: string, processId: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('decisions')
        .select('id')
        .eq('id_decisao', idDecisao)
        .eq('process_id', processId);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao verificar existência da decisão: ${error.message}`);
      }

      return (data || []).length > 0;
    } catch (error) {
      logger.errorWithException(
        `Falha ao verificar existência da decisão: ${idDecisao}`,
        error as Error,
        'DecisionsService.exists',
        { idDecisao, processId, excludeId }
      );
      throw error;
    }
  }

  /**
   * Obtém estatísticas das decisões
   * 
   * @param processId - ID do processo (opcional) para estatísticas específicas
   * @returns Promise<object> - Objeto com estatísticas das decisões
   * @throws Error se ocorrer problema na consulta
   */
  static async getStats(processId?: string): Promise<{
    total: number;
    porTipo: Record<string, number>;
    porSituacao: Record<string, number>;
    recentes: number;
  }> {
    try {
      logger.info(
        `Calculando estatísticas das decisões${processId ? ` para processo: ${processId}` : ''}`,
        'DecisionsService.getStats',
        { processId }
      );

      // Monta a query base
      let query = supabase.from('decisions').select('tipo_decisao, situacao, created_at');
      
      if (processId) {
        query = query.eq('process_id', processId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao calcular estatísticas: ${error.message}`);
      }

      const decisions = data || [];
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Calcula estatísticas
      const stats = {
        total: decisions.length,
        porTipo: decisions.reduce((acc, d) => {
          acc[d.tipo_decisao] = (acc[d.tipo_decisao] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        porSituacao: decisions.reduce((acc, d) => {
          acc[d.situacao] = (acc[d.situacao] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentes: decisions.filter(d => new Date(d.created_at) >= oneWeekAgo).length
      };

      logger.success(
        'Estatísticas de decisões calculadas com sucesso',
        'DecisionsService.getStats',
        { processId, stats }
      );

      return stats;
    } catch (error) {
      logger.errorWithException(
        'Falha ao calcular estatísticas das decisões',
        error as Error,
        'DecisionsService.getStats',
        { processId }
      );
      throw error;
    }
  }
}

export default DecisionsService;