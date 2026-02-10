/**
 * Serviço para operações CRUD da entidade Documentos
 *
 * Este serviço encapsula toda a lógica de interação com a tabela 'lancamentos_documentos'
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
import { Documento, NewDocumento } from '../types/Documento';
import { logger } from '../utils';

/**
 * Tipo para registro do banco de dados
 */
interface DocumentoRecord {
  id: string;
  process_id: string;
  tipo_documento: string;
  comentarios: string | null;
  pagina_vinculada: number | null;
  highlight_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Tipo para inserção na tabela lancamentos_documentos
 */
interface DocumentoInsert {
  process_id: string;
  tipo_documento: string;
  comentarios?: string | null;
  pagina_vinculada?: number | null;
  highlight_ids?: string[];
}

/**
 * Tipo para atualização na tabela lancamentos_documentos
 */
interface DocumentoUpdate {
  tipo_documento?: string;
  comentarios?: string | null;
  pagina_vinculada?: number | null;
  highlight_ids?: string[];
}

/**
 * Classe de serviço para gerenciar operações de lançamentos de documentos
 *
 * Esta classe fornece métodos para todas as operações relacionadas
 * à entidade Documento, garantindo a integridade referencial com
 * a tabela de processos e mantendo a consistência dos dados.
 */
export class DocumentosService {

  /**
   * Converte um registro do banco (DocumentoRecord) para o tipo da aplicação (Documento)
   *
   * Esta função é responsável por fazer a conversão entre os formatos
   * utilizados no banco de dados (snake_case, strings ISO para datas)
   * e os formatos utilizados na aplicação (camelCase, objetos Date)
   *
   * @param record - Registro do banco de dados
   * @returns Objeto Documento formatado para a aplicação
   */
  private static recordToDocumento(record: DocumentoRecord): Documento {
    return {
      id: record.id,
      processId: record.process_id,
      tipoDocumento: record.tipo_documento,
      comentarios: record.comentarios || '',
      paginaVinculada: record.pagina_vinculada ?? undefined,
      highlightIds: record.highlight_ids || [],
      dataCriacao: new Date(record.created_at),
      dataAtualizacao: new Date(record.updated_at)
    };
  }

  /**
   * Converte um NewDocumento para o formato de inserção no banco
   *
   * @param documento - Dados do novo documento
   * @returns Objeto formatado para inserção no banco
   */
  private static documentoToInsert(documento: NewDocumento): DocumentoInsert {
    return {
      process_id: documento.processId,
      tipo_documento: documento.tipoDocumento,
      comentarios: documento.comentarios || null,
      pagina_vinculada: documento.paginaVinculada ?? null,
      highlight_ids: documento.highlightIds || []
    };
  }

  /**
   * Converte dados de atualização para o formato do banco
   *
   * @param updates - Dados parciais para atualização
   * @returns Objeto formatado para atualização no banco
   */
  private static updatesToRecord(updates: Partial<NewDocumento>): DocumentoUpdate {
    const record: DocumentoUpdate = {};

    if (updates.tipoDocumento !== undefined) {
      record.tipo_documento = updates.tipoDocumento;
    }

    if (updates.comentarios !== undefined) {
      record.comentarios = updates.comentarios || null;
    }

    if (updates.paginaVinculada !== undefined) {
      record.pagina_vinculada = updates.paginaVinculada ?? null;
    }

    if (updates.highlightIds !== undefined) {
      record.highlight_ids = updates.highlightIds || [];
    }

    return record;
  }

  /**
   * Busca todos os documentos ordenados por data de atualização (mais recentes primeiro)
   *
   * @returns Promise<Documento[]> - Lista de todos os documentos
   * @throws Error se ocorrer problema na consulta
   */
  static async getAll(): Promise<Documento[]> {
    try {
      logger.info('Buscando todos os documentos...', 'DocumentosService.getAll');

      if (!supabase) {
        logger.warn('Supabase não configurado, retornando array vazio', 'DocumentosService.getAll');
        return [];
      }

      const { data, error } = await supabase
        .from('lancamentos_documentos')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`);
      }

      const documentos = (data || []).map(this.recordToDocumento);

      logger.success(
        `${documentos.length} documentos carregados com sucesso`,
        'DocumentosService.getAll',
        { count: documentos.length }
      );

      return documentos;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        logger.warn(
          'Falha de conectividade com Supabase ao buscar documentos',
          'DocumentosService.getAll'
        );
        throw new Error('Erro de conectividade com Supabase. Verifique suas credenciais e conexão de rede.');
      }

      logger.errorWithException(
        'Falha ao carregar documentos do banco de dados',
        error as Error,
        'DocumentosService.getAll'
      );
      throw error;
    }
  }

  /**
   * Busca um documento específico por ID
   *
   * @param id - UUID do documento
   * @returns Promise<Documento | null> - Documento encontrado ou null
   * @throws Error se ocorrer problema na consulta
   */
  static async getById(id: string): Promise<Documento | null> {
    try {
      logger.info(`Buscando documento por ID: ${id}`, 'DocumentosService.getById');

      const { data, error } = await supabase
        .from('lancamentos_documentos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar documento: ${error.message}`);
      }

      if (!data) {
        logger.warn(`Documento não encontrado: ${id}`, 'DocumentosService.getById');
        return null;
      }

      const documento = this.recordToDocumento(data);

      logger.success(
        `Documento encontrado: ${documento.tipoDocumento}`,
        'DocumentosService.getById',
        { id, tipoDocumento: documento.tipoDocumento }
      );

      return documento;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar documento por ID: ${id}`,
        error as Error,
        'DocumentosService.getById'
      );
      throw error;
    }
  }

  /**
   * Busca todos os documentos de um processo específico
   *
   * @param processId - UUID do processo
   * @returns Promise<Documento[]> - Lista de documentos do processo
   * @throws Error se ocorrer problema na consulta
   */
  static async getByProcessId(processId: string): Promise<Documento[]> {
    try {
      logger.info(
        `Buscando documentos do processo: ${processId}`,
        'DocumentosService.getByProcessId',
        { processId }
      );

      const { data, error } = await supabase
        .from('lancamentos_documentos')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar documentos do processo: ${error.message}`);
      }

      const documentos = (data || []).map(this.recordToDocumento);

      logger.success(
        `${documentos.length} documentos encontrados para o processo`,
        'DocumentosService.getByProcessId',
        { processId, count: documentos.length }
      );

      return documentos;
    } catch (error) {
      logger.errorWithException(
        `Falha ao buscar documentos do processo: ${processId}`,
        error as Error,
        'DocumentosService.getByProcessId',
        { processId }
      );
      throw error;
    }
  }

  /**
   * Cria um novo documento
   *
   * @param newDocumento - Dados do novo documento
   * @returns Promise<Documento> - Documento criado com ID e timestamps
   * @throws Error se ocorrer problema na criação
   */
  static async create(newDocumento: NewDocumento): Promise<Documento> {
    try {
      if (!newDocumento.tipoDocumento || !newDocumento.tipoDocumento.trim()) {
        throw new Error('Tipo de documento é obrigatório e não pode estar vazio');
      }

      if (!newDocumento.processId || !newDocumento.processId.trim()) {
        throw new Error('ID do processo é obrigatório e não pode estar vazio');
      }

      logger.info(
        `Criando novo documento: ${newDocumento.tipoDocumento}`,
        'DocumentosService.create',
        {
          tipoDocumento: newDocumento.tipoDocumento,
          processId: newDocumento.processId,
          hasPaginaVinculada: !!newDocumento.paginaVinculada
        }
      );

      if (!supabase) {
        throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      const insertData = this.documentoToInsert(newDocumento);

      const { data, error } = await supabase
        .from('lancamentos_documentos')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === '23503') {
          if (error.message.includes('process_id') || error.message.includes('processes')) {
            throw new Error(`Processo com ID "${newDocumento.processId}" não encontrado no banco de dados`);
          }
        }

        if (error.code === '23505') {
          throw new Error('Já existe um documento com estes dados');
        }

        if (error.code === '23514') {
          throw new Error(`Os dados fornecidos não atendem às restrições do banco de dados: ${error.message}`);
        }

        if (error.code === '42501') {
          throw new Error('Acesso negado. Verifique suas permissões de usuário');
        }

        throw new Error(`Erro ao criar documento: ${error.message} (Código: ${error.code})`);
      }

      if (!data) {
        throw new Error('Nenhum dado retornado após inserção. O documento pode não ter sido criado.');
      }

      const createdDocumento = this.recordToDocumento(data);

      logger.success(
        `Documento criado com sucesso: ${createdDocumento.tipoDocumento}`,
        'DocumentosService.create',
        {
          id: createdDocumento.id,
          tipoDocumento: createdDocumento.tipoDocumento,
          processId: createdDocumento.processId
        }
      );

      return createdDocumento;
    } catch (error) {
      logger.errorWithException(
        `Falha ao criar documento: ${newDocumento.tipoDocumento || 'N/A'}`,
        error as Error,
        'DocumentosService.create',
        { newDocumento }
      );
      throw error;
    }
  }

  /**
   * Atualiza um documento existente
   *
   * @param id - UUID do documento a ser atualizado
   * @param updates - Dados parciais para atualização
   * @returns Promise<Documento> - Documento atualizado
   * @throws Error se documento não existir ou ocorrer problema na atualização
   */
  static async update(id: string, updates: Partial<NewDocumento>): Promise<Documento> {
    try {
      logger.info(
        `Atualizando documento: ${id}`,
        'DocumentosService.update',
        { id, updates: Object.keys(updates) }
      );

      const updateData = this.updatesToRecord(updates);

      const { data, error } = await supabase
        .from('lancamentos_documentos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error(`Documento com ID ${id} não encontrado`);
        }

        throw new Error(`Erro ao atualizar documento: ${error.message}`);
      }

      const updatedDocumento = this.recordToDocumento(data);

      logger.success(
        `Documento atualizado com sucesso: ${updatedDocumento.tipoDocumento}`,
        'DocumentosService.update',
        {
          id: updatedDocumento.id,
          tipoDocumento: updatedDocumento.tipoDocumento,
          changedFields: Object.keys(updates)
        }
      );

      return updatedDocumento;
    } catch (error) {
      logger.errorWithException(
        `Falha ao atualizar documento: ${id}`,
        error as Error,
        'DocumentosService.update',
        { id, updates }
      );
      throw error;
    }
  }

  /**
   * Remove um documento por ID
   *
   * @param id - UUID do documento a ser removido
   * @returns Promise<boolean> - true se removido com sucesso
   * @throws Error se documento não existir ou ocorrer problema na remoção
   */
  static async delete(id: string): Promise<boolean> {
    try {
      logger.info(`Removendo documento: ${id}`, 'DocumentosService.delete');

      const existingDocumento = await this.getById(id);
      if (!existingDocumento) {
        throw new Error(`Documento com ID ${id} não encontrado`);
      }

      const { error } = await supabase
        .from('lancamentos_documentos')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao remover documento: ${error.message}`);
      }

      logger.success(
        `Documento removido com sucesso: ${existingDocumento.tipoDocumento}`,
        'DocumentosService.delete',
        {
          id,
          tipoDocumento: existingDocumento.tipoDocumento,
          processId: existingDocumento.processId
        }
      );

      return true;
    } catch (error) {
      logger.errorWithException(
        `Falha ao remover documento: ${id}`,
        error as Error,
        'DocumentosService.delete',
        { id }
      );
      throw error;
    }
  }

  /**
   * Busca documentos por termo de pesquisa
   *
   * Realiza busca nos campos: tipo_documento e comentarios
   *
   * @param searchTerm - Termo de busca
   * @param processId - ID do processo (opcional) para filtrar por processo específico
   * @returns Promise<Documento[]> - Lista de documentos que correspondem à busca
   * @throws Error se ocorrer problema na consulta
   */
  static async search(searchTerm: string, processId?: string): Promise<Documento[]> {
    try {
      if (!searchTerm.trim()) {
        return processId ? await this.getByProcessId(processId) : await this.getAll();
      }

      logger.info(
        `Pesquisando documentos por: "${searchTerm}"${processId ? ` no processo: ${processId}` : ''}`,
        'DocumentosService.search',
        { searchTerm, processId }
      );

      const sanitized = searchTerm.replace(/[%_,().*]/g, '');
      let query = supabase
        .from('lancamentos_documentos')
        .select('*')
        .or(`tipo_documento.ilike.%${sanitized}%,comentarios.ilike.%${sanitized}%`);

      if (processId) {
        query = query.eq('process_id', processId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro na pesquisa de documentos: ${error.message}`);
      }

      const documentos = (data || []).map(this.recordToDocumento);

      logger.success(
        `Pesquisa concluída: ${documentos.length} documentos encontrados`,
        'DocumentosService.search',
        { searchTerm, processId, count: documentos.length }
      );

      return documentos;
    } catch (error) {
      logger.errorWithException(
        `Falha na pesquisa de documentos: "${searchTerm}"`,
        error as Error,
        'DocumentosService.search',
        { searchTerm, processId }
      );
      throw error;
    }
  }

  /**
   * Obtém estatísticas dos documentos
   *
   * @param processId - ID do processo (opcional) para estatísticas específicas
   * @returns Promise<object> - Objeto com estatísticas dos documentos
   * @throws Error se ocorrer problema na consulta
   */
  static async getStats(processId?: string): Promise<{
    total: number;
    porTipo: Record<string, number>;
    comPaginaVinculada: number;
    recentes: number;
  }> {
    try {
      logger.info(
        `Calculando estatísticas dos documentos${processId ? ` para processo: ${processId}` : ''}`,
        'DocumentosService.getStats',
        { processId }
      );

      let query = supabase.from('lancamentos_documentos').select('tipo_documento, pagina_vinculada, created_at');

      if (processId) {
        query = query.eq('process_id', processId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao calcular estatísticas: ${error.message}`);
      }

      const documentos = data || [];
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        total: documentos.length,
        porTipo: documentos.reduce((acc, d) => {
          acc[d.tipo_documento] = (acc[d.tipo_documento] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        comPaginaVinculada: documentos.filter(d => d.pagina_vinculada !== null).length,
        recentes: documentos.filter(d => new Date(d.created_at) >= oneWeekAgo).length
      };

      logger.success(
        'Estatísticas de documentos calculadas com sucesso',
        'DocumentosService.getStats',
        { processId, stats }
      );

      return stats;
    } catch (error) {
      logger.errorWithException(
        'Falha ao calcular estatísticas dos documentos',
        error as Error,
        'DocumentosService.getStats',
        { processId }
      );
      throw error;
    }
  }
}

export default DocumentosService;
