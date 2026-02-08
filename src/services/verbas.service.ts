/**
 * Serviço para operações CRUD da entidade Verbas (estrutura hierárquica)
 * 
 * Este serviço encapsula toda a lógica de interação com as tabelas 'verbas' e 'verba_lancamentos'
 * do Supabase, fornecendo uma interface limpa para as operações de banco de dados hierárquicas.
 * 
 * Estrutura Hierárquica:
 * - Verba: Tipo de verba trabalhista (ex: Horas Extras, Danos Morais)
 * - Lançamentos: Decisões específicas sobre essa verba (ex: Deferida, Reformada)
 * 
 * Funcionalidades:
 * - CRUD hierárquico (Verba > Lançamentos)
 * - Validação de dados e relacionamentos
 * - Tratamento de erros específicos
 * - Conversão entre formatos da aplicação e do banco
 * - Logging detalhado de operações
 * - Consultas otimizadas por processo
 */

import { supabase } from '../lib/supabase.tsx';
import {
  VerbaRecord,
  VerbaLancamentoRecord,
  Database
} from '../types/database';
import { Verba, VerbaLancamento, NewVerbaComLancamento, NewVerbaLancamento, ChecklistStats } from '../types/Verba';
import { logger } from '../utils';

/**
 * Tipos para inserção nas tabelas
 */
type VerbaInsert = Database['public']['Tables']['verbas']['Insert'];
type VerbaLancamentoInsert = Database['public']['Tables']['verba_lancamentos']['Insert'];

/**
 * Tipos para atualização nas tabelas
 */
type VerbaUpdate = Database['public']['Tables']['verbas']['Update'];
type VerbaLancamentoUpdate = Database['public']['Tables']['verba_lancamentos']['Update'];

/**
 * Classe de serviço para gerenciar operações hierárquicas de verbas trabalhistas
 * 
 * Esta classe fornece métodos para todas as operações relacionadas
 * às entidades Verba e VerbaLancamento, mantendo a integridade
 * da estrutura hierárquica e dos relacionamentos no banco de dados.
 */
export class VerbasService {

  /**
   * Função auxiliar para atualizar o campo updated_at de uma verba pai
   * 
   * Esta função força uma atualização no registro da verba, o que automaticamente
   * atualiza o campo updated_at através do trigger do banco de dados.
   * Isso é necessário para garantir que a aplicação detecte mudanças nos lançamentos.
   * 
   * @param verbaId - UUID da verba a ter o updated_at atualizado
   * @param processId - UUID do processo (para validação de integridade)
   * @throws Error se a verba não existir ou ocorrer problema na atualização
   */
  private static async touchVerbaUpdatedAt(verbaId: string, processId: string): Promise<void> {
    try {
      logger.info(
        `Atualizando timestamp da verba pai: ${verbaId}`,
        'VerbasService.touchVerbaUpdatedAt',
        { verbaId, processId }
      );

      // Executa um UPDATE que não altera dados, mas dispara o trigger updated_at
      const { error } = await supabase
        .from('verbas')
        .update({ process_id: processId }) // Atualiza para o mesmo valor (não muda dados)
        .eq('id', verbaId);

      if (error) {
        throw new Error(`Erro ao atualizar timestamp da verba: ${error.message}`);
      }

      logger.success(
        `Timestamp da verba pai atualizado com sucesso`,
        'VerbasService.touchVerbaUpdatedAt',
        { verbaId }
      );
    } catch (error) {
      logger.errorWithException(
        `Falha ao atualizar timestamp da verba pai: ${verbaId}`,
        error as Error,
        'VerbasService.touchVerbaUpdatedAt',
        { verbaId, processId }
      );
      throw error;
    }
  }

  /**
   * Converte um registro de lançamento do banco para o tipo da aplicação
   * 
   * @param record - Registro do lançamento do banco de dados
   * @returns Objeto VerbaLancamento formatado para a aplicação
   */
  private static recordToLancamento(record: VerbaLancamentoRecord): VerbaLancamento {
    return {
      id: record.id,
      decisaoVinculada: record.decisao_vinculada,
      situacao: record.situacao,
      fundamentacao: record.fundamentacao || '',
      comentariosCalculistas: record.comentarios_calculistas || '',
      verbaId: record.verba_id,
      paginaVinculada: record.pagina_vinculada ?? undefined,
      processDocumentId: record.process_document_id ?? undefined,
      highlightId: record.highlight_id ?? undefined,
      highlightIds: record.highlight_ids || [],
      checkCalculista: record.check_calculista ?? false,
      checkCalculistaAt: record.check_calculista_at ? new Date(record.check_calculista_at) : undefined,
      checkRevisor: record.check_revisor ?? false,
      checkRevisorAt: record.check_revisor_at ? new Date(record.check_revisor_at) : undefined,
      dataCriacao: new Date(record.created_at),
      dataAtualizacao: new Date(record.updated_at)
    };
  }

  /**
   * Converte um registro de verba do banco para o tipo da aplicação
   * 
   * @param verbaRecord - Registro da verba do banco de dados
   * @param lancamentosRecords - Registros dos lançamentos associados
   * @returns Objeto Verba formatado para a aplicação com estrutura hierárquica
   */
  private static recordToVerba(
    verbaRecord: VerbaRecord,
    lancamentosRecords: VerbaLancamentoRecord[] = []
  ): Verba {
    return {
      id: verbaRecord.id,
      processId: verbaRecord.process_id,
      tipoVerba: verbaRecord.tipo_verba,
      lancamentos: lancamentosRecords.map(this.recordToLancamento),
      dataCriacao: new Date(verbaRecord.created_at),
      dataAtualizacao: new Date(verbaRecord.updated_at)
    };
  }

  /**
   * Converte dados de nova verba para formato de inserção no banco
   * 
   * @param verba - Dados da nova verba
   * @returns Objeto formatado para inserção na tabela verbas
   */
  private static verbaToInsert(processId: string, tipoVerba: string): VerbaInsert {
    return {
      process_id: processId,
      tipo_verba: tipoVerba // Agora é TEXT dinâmico, não precisa de cast
    };
  }

  /**
   * Converte dados de novo lançamento para formato de inserção no banco
   * 
   * @param lancamento - Dados do novo lançamento
   * @param verbaId - ID da verba pai
   * @returns Objeto formatado para inserção na tabela verba_lancamentos
   */
  private static lancamentoToInsert(
    lancamento: NewVerbaLancamento,
    verbaId: string
  ): VerbaLancamentoInsert {
    const fundamentacao = lancamento.fundamentacao?.trim() || null;
    const comentariosCalculistas = lancamento.comentariosCalculistas?.trim() || null;
    const paginaVinculada = lancamento.paginaVinculada || null;
    const processDocumentId = lancamento.processDocumentId || null;
    const highlightId = lancamento.highlightId || null;
    const highlightIds = lancamento.highlightIds || [];

    return {
      verba_id: verbaId,
      decisao_vinculada: lancamento.decisaoVinculada,
      situacao: lancamento.situacao,
      fundamentacao,
      comentarios_calculistas: comentariosCalculistas,
      pagina_vinculada: paginaVinculada,
      process_document_id: processDocumentId,
      highlight_id: highlightId,
      highlight_ids: highlightIds
    };
  }

  /**
   * Converte dados de atualização de lançamento para formato do banco
   * 
   * @param updates - Dados parciais para atualização do lançamento
   * @returns Objeto formatado para atualização na tabela verba_lancamentos
   */
  private static lancamentoUpdatesToRecord(updates: Partial<NewVerbaLancamento>): VerbaLancamentoUpdate {
    const record: VerbaLancamentoUpdate = {};

    if (updates.decisaoVinculada !== undefined) {
      record.decisao_vinculada = updates.decisaoVinculada;
    }

    if (updates.situacao !== undefined) {
      record.situacao = updates.situacao;
    }

    if (updates.fundamentacao !== undefined) {
      record.fundamentacao = updates.fundamentacao || null;
    }

    if (updates.comentariosCalculistas !== undefined) {
      record.comentarios_calculistas = updates.comentariosCalculistas || null;
    }

    if (updates.paginaVinculada !== undefined) {
      record.pagina_vinculada = updates.paginaVinculada || null;
    }

    if (updates.processDocumentId !== undefined) {
      record.process_document_id = updates.processDocumentId || null;
    }

    if (updates.highlightId !== undefined) {
      record.highlight_id = updates.highlightId || null;
    }

    if (updates.highlightIds !== undefined) {
      record.highlight_ids = updates.highlightIds || [];
    }

    if (updates.checkCalculista !== undefined) {
      record.check_calculista = updates.checkCalculista;
    }

    if (updates.checkCalculistaAt !== undefined) {
      record.check_calculista_at = updates.checkCalculistaAt ? new Date(updates.checkCalculistaAt).toISOString() : null;
    }

    if (updates.checkRevisor !== undefined) {
      record.check_revisor = updates.checkRevisor;
    }

    if (updates.checkRevisorAt !== undefined) {
      record.check_revisor_at = updates.checkRevisorAt ? new Date(updates.checkRevisorAt).toISOString() : null;
    }

    return record;
  }

  /**
   * Busca todas as verbas com seus lançamentos, ordenadas por data de atualização
   * 
   * @returns Promise<Verba[]> - Lista de todas as verbas com estrutura hierárquica
   * @throws Error se ocorrer problema na consulta
   */
  static async getAll(): Promise<Verba[]> {
    try {
      logger.info('Buscando todas as verbas com lançamentos...', 'VerbasService.getAll');

      // Verifica se Supabase está disponível
      if (!supabase) {
        logger.warn('Supabase não configurado, retornando array vazio', 'VerbasService.getAll');
        return [];
      }

      // Busca verbas com lançamentos usando join
      const { data, error } = await supabase
        .from('verbas')
        .select(`
          *,
          verba_lancamentos (*)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar verbas: ${error.message}`);
      }

      const verbas = (data || []).map(verbaData => {
        const { verba_lancamentos, ...verbaRecord } = verbaData;
        return this.recordToVerba(
          verbaRecord as VerbaRecord,
          (verba_lancamentos || []) as VerbaLancamentoRecord[]
        );
      });

      logger.success(
        `${verbas.length} verbas carregadas com sucesso`,
        'VerbasService.getAll',
        { 
          count: verbas.length,
          totalLancamentos: verbas.reduce((acc, v) => acc + v.lancamentos.length, 0)
        }
      );

      return verbas;
    } catch (error) {
      logger.errorWithException(
        'Falha ao carregar verbas do banco de dados',
        error as Error,
        'VerbasService.getAll'
      );
      throw error;
    }
  }

  /**
   * Busca uma verba específica por ID com seus lançamentos
   * 
   * @param id - UUID da verba
   * @returns Promise<Verba | null> - Verba encontrada com lançamentos ou null
   * @throws Error se ocorrer problema na consulta
   */
  static async getById(id: string): Promise<Verba | null> {
    try {
      logger.info(`Buscando verba por ID: ${id}`, 'VerbasService.getById');

      const { data, error } = await supabase
        .from('verbas')
        .select(`
          *,
          verba_lancamentos (*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar verba: ${error.message} (código: ${error.code})`);
      }

      if (!data) {
        logger.warn(`Verba não encontrada: ${id}`, 'VerbasService.getById');
        return null;
      }

      const { verba_lancamentos, ...verbaRecord } = data;
      const verba = this.recordToVerba(
        verbaRecord as VerbaRecord,
        (verba_lancamentos || []) as VerbaLancamentoRecord[]
      );

      logger.success(
        `Verba encontrada: ${verba.tipoVerba}`,
        'VerbasService.getById',
        { 
          id, 
          tipoVerba: verba.tipoVerba, 
          lancamentosCount: verba.lancamentos.length 
        }
      );

      return verba;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar verba por ID: ${id}`,
        error as Error,
        'VerbasService.getById'
      );
      throw error;
    }
  }

  /**
   * Busca todas as verbas de um processo específico com seus lançamentos
   * 
   * @param processId - UUID do processo
   * @returns Promise<Verba[]> - Lista de verbas do processo com estrutura hierárquica
   * @throws Error se ocorrer problema na consulta
   */
  static async getByProcessId(processId: string): Promise<Verba[]> {
    try {
      logger.info(
        `Buscando verbas do processo: ${processId}`,
        'VerbasService.getByProcessId',
        { processId }
      );

      const { data, error } = await supabase
        .from('verbas')
        .select(`
          *,
          verba_lancamentos (*)
        `)
        .eq('process_id', processId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar verbas do processo: ${error.message}`);
      }

      const verbas = (data || []).map(verbaData => {
        const { verba_lancamentos, ...verbaRecord } = verbaData;
        return this.recordToVerba(
          verbaRecord as VerbaRecord,
          (verba_lancamentos || []) as VerbaLancamentoRecord[]
        );
      });

      logger.success(
        `${verbas.length} verbas encontradas para o processo`,
        'VerbasService.getByProcessId',
        { 
          processId, 
          count: verbas.length,
          totalLancamentos: verbas.reduce((acc, v) => acc + v.lancamentos.length, 0)
        }
      );

      return verbas;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar verbas do processo: ${processId}`,
        error as Error,
        'VerbasService.getByProcessId',
        { processId }
      );
      throw error;
    }
  }

  /**
   * Cria uma nova verba com lançamento (operação hierárquica)
   * 
   * Esta operação cria ou utiliza uma verba existente e adiciona um novo lançamento
   * 
   * @param novaVerba - Dados da nova verba com lançamento
   * @returns Promise<Verba> - Verba criada ou atualizada com o novo lançamento
   * @throws Error se ocorrer problema na criação
   */
  static async createVerbaComLancamento(novaVerba: NewVerbaComLancamento): Promise<Verba> {
    try {
      logger.info(
        `Criando verba com lançamento: ${novaVerba.tipoVerba}`,
        'VerbasService.createVerbaComLancamento',
        {
          tipoVerba: novaVerba.tipoVerba,
          processId: novaVerba.processId,
          decisaoVinculada: novaVerba.lancamento.decisaoVinculada
        }
      );

      // Usa sempre o método manual para garantir compatibilidade
      const verba = await this.createVerbaComLancamentoManual(novaVerba);

      logger.success(
        `Verba com lançamento criada com sucesso: ${verba.tipoVerba}`,
        'VerbasService.createVerbaComLancamento',
        {
          verbaId: verba.id,
          tipoVerba: verba.tipoVerba,
          lancamentosCount: verba.lancamentos.length
        }
      );

      return verba;
    } catch (error) {
      logger.errorWithException(
        `Falha ao criar verba com lançamento: ${novaVerba.tipoVerba}`,
        error as Error,
        'VerbasService.createVerbaComLancamento',
        { novaVerba }
      );
      throw error;
    }
  }

  /**
   * Implementação manual da criação de verba com lançamento
   * 
   * @param novaVerba - Dados da nova verba com lançamento
   * @returns Promise<Verba> - Verba criada ou atualizada
   */
  private static async createVerbaComLancamentoManual(novaVerba: NewVerbaComLancamento): Promise<Verba> {
    logger.info(
      'Iniciando criação manual de verba com lançamento',
      'VerbasService.createVerbaComLancamentoManual',
      { tipoVerba: novaVerba.tipoVerba, processId: novaVerba.processId, lancamento: novaVerba.lancamento }
    );

    // Verifica se já existe uma verba deste tipo no processo
    const { data: verbaExistente, error: searchError } = await supabase
      .from('verbas')
      .select('id')
      .eq('process_id', novaVerba.processId)
      .eq('tipo_verba', novaVerba.tipoVerba)
      .maybeSingle();

    if (searchError) {
      logger.errorWithException(
        'Erro ao verificar verba existente',
        new Error(searchError.message),
        'VerbasService.createVerbaComLancamentoManual',
        { searchError }
      );
      throw new Error(`Erro ao verificar verba existente: ${searchError.message}`);
    }

    let verbaId: string;

    if (verbaExistente) {
      // Usa verba existente
      verbaId = verbaExistente.id;
      logger.info(
        'Verba existente encontrada, adicionando lançamento',
        'VerbasService.createVerbaComLancamentoManual',
        { verbaId }
      );

      // Atualiza timestamp da verba pai usando função auxiliar
      await this.touchVerbaUpdatedAt(verbaId, novaVerba.processId);
        
    } else {
      // Cria nova verba
      const insertVerbaData = this.verbaToInsert(novaVerba.processId, novaVerba.tipoVerba);
      logger.info(
        'Criando nova verba',
        'VerbasService.createVerbaComLancamentoManual',
        { insertVerbaData }
      );

      const { data: newVerba, error: createVerbaError } = await supabase
        .from('verbas')
        .insert(insertVerbaData)
        .select()
        .single();

      if (createVerbaError) {
        logger.errorWithException(
          'Erro ao criar verba',
          new Error(createVerbaError.message),
          'VerbasService.createVerbaComLancamentoManual',
          { createVerbaError, insertVerbaData }
        );
        // Tratamento específico para erro de chave estrangeira (processo não existe)
        if (createVerbaError.code === '23503' && createVerbaError.message.includes('process_id')) {
          throw new Error(`Processo com ID ${novaVerba.processId} não encontrado`);
        }
        throw new Error(`Erro ao criar verba: ${createVerbaError.message}`);
      }

      verbaId = newVerba.id;
      logger.success(
        'Nova verba criada com sucesso',
        'VerbasService.createVerbaComLancamentoManual',
        { verbaId }
      );
    }

    // Cria o lançamento
    const insertLancamentoData = this.lancamentoToInsert(novaVerba.lancamento, verbaId);
    logger.info(
      'Criando lançamento da verba',
      'VerbasService.createVerbaComLancamentoManual',
      { insertLancamentoData, verbaId }
    );

    const { error: createLancamentoError } = await supabase
      .from('verba_lancamentos')
      .insert(insertLancamentoData);

    if (createLancamentoError) {
      logger.errorWithException(
        'Erro ao criar lançamento',
        new Error(createLancamentoError.message),
        'VerbasService.createVerbaComLancamentoManual',
        { createLancamentoError, insertLancamentoData, verbaId }
      );
      throw new Error(`Erro ao criar lançamento: ${createLancamentoError.message}`);
    }

    logger.success(
      'Lançamento criado com sucesso',
      'VerbasService.createVerbaComLancamentoManual',
      { verbaId, decisaoVinculada: novaVerba.lancamento.decisaoVinculada }
    );

    // Retorna a verba completa
    const verba = await this.getById(verbaId);
    if (!verba) {
      throw new Error('Verba não encontrada após criação');
    }

    return verba;
  }

  /**
   * Atualiza um lançamento específico de uma verba
   * 
   * @param verbaId - UUID da verba
   * @param lancamentoId - UUID do lançamento a ser atualizado
   * @param updates - Dados parciais para atualização do lançamento
   * @returns Promise<VerbaLancamento> - Lançamento atualizado
   * @throws Error se lançamento não existir ou ocorrer problema na atualização
   */
  static async updateLancamento(
    verbaId: string,
    lancamentoId: string,
    updates: Partial<NewVerbaLancamento>
  ): Promise<VerbaLancamento> {
    try {
      logger.info(
        `Atualizando lançamento: ${lancamentoId} da verba: ${verbaId}`,
        'VerbasService.updateLancamento',
        { verbaId, lancamentoId, updates: Object.keys(updates) }
      );

      const updateData = this.lancamentoUpdatesToRecord(updates);

      const { data, error } = await supabase
        .from('verba_lancamentos')
        .update(updateData)
        .eq('id', lancamentoId)
        .eq('verba_id', verbaId) // Verifica se o lançamento pertence à verba
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao atualizar lançamento: ${error.message} (código: ${error.code})`);
      }

      if (!data) {
        throw new Error(`Lançamento com ID ${lancamentoId} não encontrado`);
      }

      const updatedLancamento = this.recordToLancamento(data);

      // Busca o process_id da verba para atualizar o timestamp corretamente
      const { data: verbaData, error: verbaError } = await supabase
        .from('verbas')
        .select('process_id')
        .eq('id', verbaId)
        .single();

      if (verbaError) {
        logger.warn(
          `Não foi possível buscar process_id da verba para atualizar timestamp: ${verbaError.message}`,
          'VerbasService.updateLancamento',
          { verbaId, lancamentoId }
        );
      } else {
        // Atualiza timestamp da verba pai usando função auxiliar
        await this.touchVerbaUpdatedAt(verbaId, verbaData.process_id);
      }

      logger.success(
        `Lançamento atualizado com sucesso: ${updatedLancamento.decisaoVinculada}`,
        'VerbasService.updateLancamento',
        {
          lancamentoId: updatedLancamento.id,
          verbaId,
          decisaoVinculada: updatedLancamento.decisaoVinculada,
          changedFields: Object.keys(updates)
        }
      );

      return updatedLancamento;
    } catch (error) {
      logger.errorWithException(
        `Falha ao atualizar lançamento: ${lancamentoId}`,
        error as Error,
        'VerbasService.updateLancamento',
        { verbaId, lancamentoId, updates }
      );
      throw error;
    }
  }

  /**
   * Remove um lançamento específico de uma verba
   * 
   * Se for o último lançamento da verba, remove a verba inteira
   * 
   * @param verbaId - UUID da verba
   * @param lancamentoId - UUID do lançamento a ser removido
   * @returns Promise<boolean> - true se removido com sucesso
   * @throws Error se lançamento não existir ou ocorrer problema na remoção
   */
  static async removeLancamento(verbaId: string, lancamentoId: string): Promise<boolean> {
    try {
      logger.info(
        `Removendo lançamento: ${lancamentoId} da verba: ${verbaId}`,
        'VerbasService.removeLancamento'
      );

      const verba = await this.getById(verbaId);

      if (!verba) {
        logger.warn(
          `Verba ${verbaId} não encontrada no banco durante exclusão - possível dessincronização`,
          'VerbasService.removeLancamento',
          { verbaId, lancamentoId }
        );
        return true;
      }

      const lancamento = verba.lancamentos.find(l => l.id === lancamentoId);

      if (!lancamento) {
        logger.warn(
          `Lançamento ${lancamentoId} não encontrado na verba ${verbaId}`,
          'VerbasService.removeLancamento',
          { verbaId, lancamentoId }
        );
        return true;
      }

      const isLastLancamento = verba.lancamentos.length === 1;

      if (isLastLancamento) {
        const { error } = await supabase
          .from('verbas')
          .delete()
          .eq('id', verbaId);

        if (error) {
          throw new Error(`Erro ao remover verba: ${error.message}`);
        }

        logger.success(
          `Verba "${verba.tipoVerba}" removida (último lançamento)`,
          'VerbasService.removeLancamento',
          {
            verbaId,
            lancamentoId,
            tipoVerba: verba.tipoVerba,
            decisaoVinculada: lancamento.decisaoVinculada
          }
        );
      } else {
        const { error } = await supabase
          .from('verba_lancamentos')
          .delete()
          .eq('id', lancamentoId)
          .eq('verba_id', verbaId);

        if (error) {
          throw new Error(`Erro ao remover lançamento: ${error.message}`);
        }

        await this.touchVerbaUpdatedAt(verbaId, verba.processId);

        logger.success(
          `Lançamento removido da verba "${verba.tipoVerba}"`,
          'VerbasService.removeLancamento',
          {
            verbaId,
            lancamentoId,
            tipoVerba: verba.tipoVerba,
            decisaoVinculada: lancamento.decisaoVinculada
          }
        );
      }

      return true;
    } catch (error) {
      logger.errorWithException(
        `Falha ao remover lançamento: ${lancamentoId}`,
        error as Error,
        'VerbasService.removeLancamento',
        { verbaId, lancamentoId }
      );
      throw error;
    }
  }

  /**
   * Remove uma verba inteira com todos os seus lançamentos
   * 
   * @param verbaId - UUID da verba a ser removida
   * @returns Promise<boolean> - true se removida com sucesso
   * @throws Error se verba não existir ou ocorrer problema na remoção
   */
  static async removeVerba(verbaId: string): Promise<boolean> {
    try {
      logger.info(`Removendo verba completa: ${verbaId}`, 'VerbasService.removeVerba');

      // Primeiro, busca a verba para logging
      const verba = await this.getById(verbaId);
      if (!verba) {
        throw new Error(`Verba com ID ${verbaId} não encontrada`);
      }

      const { error } = await supabase
        .from('verbas')
        .delete()
        .eq('id', verbaId);

      if (error) {
        throw new Error(`Erro ao remover verba: ${error.message}`);
      }

      logger.success(
        `Verba "${verba.tipoVerba}" e todos seus lançamentos removidos`,
        'VerbasService.removeVerba',
        {
          verbaId,
          tipoVerba: verba.tipoVerba,
          lancamentosCount: verba.lancamentos.length
        }
      );

      return true;
    } catch (error) {
      logger.errorWithException(
        `Falha ao remover verba: ${verbaId}`,
        error as Error,
        'VerbasService.removeVerba',
        { verbaId }
      );
      throw error;
    }
  }

  /**
   * Obtém estatísticas das verbas
   * 
   * @param processId - ID do processo (opcional) para estatísticas específicas
   * @returns Promise<object> - Objeto com estatísticas das verbas
   * @throws Error se ocorrer problema na consulta
   */
  static async getStats(processId?: string): Promise<{
    totalVerbas: number;
    totalLancamentos: number;
    porTipoVerba: Record<string, number>;
    porSituacao: Record<string, number>;
    recentes: number;
  }> {
    try {
      logger.info(
        `Calculando estatísticas das verbas${processId ? ` para processo: ${processId}` : ''}`,
        'VerbasService.getStats',
        { processId }
      );

      // Monta a query para verbas
      let verbaQuery = supabase.from('verbas').select('tipo_verba, created_at');
      if (processId) {
        verbaQuery = verbaQuery.eq('process_id', processId);
      }

      // Monta a query para lançamentos
      let lancamentoQuery = supabase
        .from('verba_lancamentos')
        .select('situacao, created_at, verba_id');

      if (processId) {
        // Para lançamentos, precisa fazer join com verbas para filtrar por processo
        lancamentoQuery = supabase
          .from('verba_lancamentos')
          .select(`
            situacao, 
            created_at,
            verbas!inner(process_id)
          `)
          .eq('verbas.process_id', processId);
      }

      const [verbasResult, lancamentosResult] = await Promise.all([
        verbaQuery,
        lancamentoQuery
      ]);

      if (verbasResult.error) {
        throw new Error(`Erro ao buscar verbas: ${verbasResult.error.message}`);
      }

      if (lancamentosResult.error) {
        throw new Error(`Erro ao buscar lançamentos: ${lancamentosResult.error.message}`);
      }

      const verbas = verbasResult.data || [];
      const lancamentos = lancamentosResult.data || [];

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Calcula estatísticas
      const stats = {
        totalVerbas: verbas.length,
        totalLancamentos: lancamentos.length,
        porTipoVerba: verbas.reduce((acc, v) => {
          acc[v.tipo_verba] = (acc[v.tipo_verba] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        porSituacao: lancamentos.reduce((acc, l) => {
          acc[l.situacao] = (acc[l.situacao] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentes: verbas.filter(v => new Date(v.created_at) >= oneWeekAgo).length
      };

      logger.success(
        'Estatísticas de verbas calculadas com sucesso',
        'VerbasService.getStats',
        { processId, stats }
      );

      return stats;
    } catch (error) {
      logger.errorWithException(
        'Falha ao calcular estatísticas das verbas',
        error as Error,
        'VerbasService.getStats',
        { processId }
      );
      throw error;
    }
  }

  /**
   * Alterna o check do calculista para um lançamento
   *
   * @param lancamentoId - UUID do lançamento
   * @param checked - Novo valor do check
   * @returns Promise<VerbaLancamento> - Lançamento atualizado
   */
  static async toggleCheckCalculista(lancamentoId: string, checked: boolean): Promise<VerbaLancamento> {
    try {
      logger.info(
        `Alternando check calculista: ${lancamentoId} -> ${checked}`,
        'VerbasService.toggleCheckCalculista'
      );

      const updateData: Record<string, unknown> = {
        check_calculista: checked,
        check_calculista_at: checked ? new Date().toISOString() : null
      };

      if (!checked) {
        updateData.check_revisor = false;
        updateData.check_revisor_at = null;
      }

      const { data, error } = await supabase
        .from('verba_lancamentos')
        .update(updateData)
        .eq('id', lancamentoId)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar check calculista: ${error.message}`);
      }

      const updatedLancamento = this.recordToLancamento(data);

      logger.success(
        `Check calculista atualizado: ${lancamentoId} -> ${checked}`,
        'VerbasService.toggleCheckCalculista'
      );

      return updatedLancamento;
    } catch (error) {
      logger.errorWithException(
        `Falha ao alternar check calculista: ${lancamentoId}`,
        error as Error,
        'VerbasService.toggleCheckCalculista'
      );
      throw error;
    }
  }

  /**
   * Alterna o check do revisor para um lançamento
   *
   * @param lancamentoId - UUID do lançamento
   * @param checked - Novo valor do check
   * @returns Promise<VerbaLancamento> - Lançamento atualizado
   */
  static async toggleCheckRevisor(lancamentoId: string, checked: boolean): Promise<VerbaLancamento> {
    try {
      logger.info(
        `Alternando check revisor: ${lancamentoId} -> ${checked}`,
        'VerbasService.toggleCheckRevisor'
      );

      if (checked) {
        const { data: currentData } = await supabase
          .from('verba_lancamentos')
          .select('check_calculista')
          .eq('id', lancamentoId)
          .single();

        if (!currentData?.check_calculista) {
          throw new Error('O check do calculista precisa estar marcado antes de marcar a revisão');
        }
      }

      const { data, error } = await supabase
        .from('verba_lancamentos')
        .update({
          check_revisor: checked,
          check_revisor_at: checked ? new Date().toISOString() : null
        })
        .eq('id', lancamentoId)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar check revisor: ${error.message}`);
      }

      const updatedLancamento = this.recordToLancamento(data);

      logger.success(
        `Check revisor atualizado: ${lancamentoId} -> ${checked}`,
        'VerbasService.toggleCheckRevisor'
      );

      return updatedLancamento;
    } catch (error) {
      logger.errorWithException(
        `Falha ao alternar check revisor: ${lancamentoId}`,
        error as Error,
        'VerbasService.toggleCheckRevisor'
      );
      throw error;
    }
  }

  /**
   * Obtém estatísticas do checklist para um processo
   *
   * @param processId - UUID do processo
   * @returns Promise<ChecklistStats> - Estatísticas do checklist
   */
  static async getChecklistStats(processId: string): Promise<ChecklistStats> {
    try {
      logger.info(
        `Calculando estatísticas de checklist para processo: ${processId}`,
        'VerbasService.getChecklistStats'
      );

      const { data, error } = await supabase
        .from('verba_lancamentos')
        .select(`
          check_calculista,
          check_revisor,
          verbas!inner(process_id)
        `)
        .eq('verbas.process_id', processId);

      if (error) {
        throw new Error(`Erro ao buscar dados de checklist: ${error.message}`);
      }

      const lancamentos = data || [];
      const total = lancamentos.length;
      const pendentes = lancamentos.filter(l => !l.check_calculista && !l.check_revisor).length;
      const aguardandoRevisao = lancamentos.filter(l => l.check_calculista && !l.check_revisor).length;
      const concluidos = lancamentos.filter(l => l.check_calculista && l.check_revisor).length;
      const percentualConcluido = total > 0 ? Math.round((concluidos / total) * 100) : 0;

      const stats: ChecklistStats = {
        total,
        pendentes,
        aguardandoRevisao,
        concluidos,
        percentualConcluido
      };

      logger.success(
        'Estatísticas de checklist calculadas',
        'VerbasService.getChecklistStats',
        { processId, stats }
      );

      return stats;
    } catch (error) {
      logger.errorWithException(
        `Falha ao calcular estatísticas de checklist: ${processId}`,
        error as Error,
        'VerbasService.getChecklistStats'
      );
      throw error;
    }
  }

  /**
   * Atualiza o status das verbas do processo baseado nos checks
   *
   * @param processId - UUID do processo
   * @returns Promise<'pendente' | 'em_andamento' | 'concluido'> - Novo status
   */
  static async updateProcessVerbaStatus(processId: string): Promise<'pendente' | 'em_andamento' | 'concluido'> {
    try {
      const stats = await this.getChecklistStats(processId);

      let newStatus: 'pendente' | 'em_andamento' | 'concluido';

      if (stats.total === 0 || stats.pendentes === stats.total) {
        newStatus = 'pendente';
      } else if (stats.concluidos === stats.total) {
        newStatus = 'concluido';
      } else {
        newStatus = 'em_andamento';
      }

      const { error } = await supabase
        .from('processes')
        .update({ status_verbas: newStatus })
        .eq('id', processId);

      if (error) {
        throw new Error(`Erro ao atualizar status do processo: ${error.message}`);
      }

      logger.success(
        `Status de verbas do processo atualizado: ${newStatus}`,
        'VerbasService.updateProcessVerbaStatus',
        { processId, newStatus, stats }
      );

      return newStatus;
    } catch (error) {
      logger.errorWithException(
        `Falha ao atualizar status de verbas do processo: ${processId}`,
        error as Error,
        'VerbasService.updateProcessVerbaStatus'
      );
      throw error;
    }
  }
}

export default VerbasService;