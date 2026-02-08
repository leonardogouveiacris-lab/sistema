import { supabase } from '../lib/supabase';
import { DocumentoLancamento, DocumentoLancamentoCreateInput, DocumentoLancamentoUpdateInput } from '../types';
import logger from '../utils/logger';

class DocumentoLancamentoService {
  private tableName = 'lancamentos_documentos';

  async getByProcessId(processId: string): Promise<DocumentoLancamento[]> {
    try {
      logger.info(`Fetching document launches for process: ${processId}`, 'DocumentoLancamentoService.getByProcessId');

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`Error fetching document launches: ${error.message}`, 'DocumentoLancamentoService.getByProcessId');
        throw error;
      }

      const documentos = (data || []).map(this.mapToDocumentoLancamento);
      logger.success(`Fetched ${documentos.length} document launches`, 'DocumentoLancamentoService.getByProcessId');

      return documentos;
    } catch (error) {
      logger.errorWithException('Failed to fetch document launches', error as Error, 'DocumentoLancamentoService.getByProcessId');
      throw error;
    }
  }

  async create(input: DocumentoLancamentoCreateInput): Promise<DocumentoLancamento> {
    try {
      logger.info(`Creating document launch for process: ${input.processId}`, 'DocumentoLancamentoService.create');

      const { data, error } = await supabase
        .from(this.tableName)
        .insert({
          process_id: input.processId,
          tipo_documento: input.tipoDocumento,
          comentarios: input.comentarios,
          pagina_vinculada: input.paginaVinculada,
        })
        .select()
        .single();

      if (error) {
        logger.error(`Error creating document launch: ${error.message}`, 'DocumentoLancamentoService.create');
        throw error;
      }

      const documento = this.mapToDocumentoLancamento(data);
      logger.success(`Document launch created with ID: ${documento.id}`, 'DocumentoLancamentoService.create');

      return documento;
    } catch (error) {
      logger.errorWithException('Failed to create document launch', error as Error, 'DocumentoLancamentoService.create');
      throw error;
    }
  }

  async update(id: string, input: DocumentoLancamentoUpdateInput): Promise<DocumentoLancamento> {
    try {
      logger.info(`Updating document launch: ${id}`, 'DocumentoLancamentoService.update');

      const updateData: Record<string, unknown> = {};

      if (input.tipoDocumento !== undefined) updateData.tipo_documento = input.tipoDocumento;
      if (input.comentarios !== undefined) updateData.comentarios = input.comentarios || null;
      if (input.paginaVinculada !== undefined) updateData.pagina_vinculada = input.paginaVinculada || null;
      if (input.processDocumentId !== undefined) updateData.process_document_id = input.processDocumentId || null;

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error(`Error updating document launch: ${error.message}`, 'DocumentoLancamentoService.update');
        throw error;
      }

      const documento = this.mapToDocumentoLancamento(data);
      logger.success(`Document launch updated: ${id}`, 'DocumentoLancamentoService.update');

      return documento;
    } catch (error) {
      logger.errorWithException('Failed to update document launch', error as Error, 'DocumentoLancamentoService.update');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      logger.info(`Deleting document launch: ${id}`, 'DocumentoLancamentoService.delete');

      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        logger.error(`Error deleting document launch: ${error.message}`, 'DocumentoLancamentoService.delete');
        throw error;
      }

      logger.success(`Document launch deleted: ${id}`, 'DocumentoLancamentoService.delete');
    } catch (error) {
      logger.errorWithException('Failed to delete document launch', error as Error, 'DocumentoLancamentoService.delete');
      throw error;
    }
  }

  private mapToDocumentoLancamento(data: any): DocumentoLancamento {
    return {
      id: data.id,
      processId: data.process_id,
      tipoDocumento: data.tipo_documento,
      comentarios: data.comentarios ?? undefined,
      paginaVinculada: data.pagina_vinculada ?? undefined,
      processDocumentId: data.process_document_id ?? undefined,
      dataCriacao: new Date(data.created_at),
      dataAtualizacao: new Date(data.updated_at),
    };
  }
}

export const documentoLancamentoService = new DocumentoLancamentoService();
