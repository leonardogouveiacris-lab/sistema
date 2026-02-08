import { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentoLancamento, DocumentoLancamentoCreateInput, DocumentoLancamentoUpdateInput } from '../types';
import { documentoLancamentoService } from '../services';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import logger from '../utils/logger';

interface UseDocumentoLancamentosResult {
  documentos: DocumentoLancamento[];
  loading: boolean;
  error: string | null;
  createDocumento: (input: DocumentoLancamentoCreateInput) => Promise<DocumentoLancamento | null>;
  updateDocumento: (id: string, input: DocumentoLancamentoUpdateInput) => Promise<DocumentoLancamento | null>;
  deleteDocumento: (id: string) => Promise<boolean>;
  refreshDocumentos: () => Promise<void>;
}

export const useDocumentoLancamentos = (processId: string | null): UseDocumentoLancamentosResult => {
  const [documentos, setDocumentos] = useState<DocumentoLancamento[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isLocalUpdate = useRef(false);

  const fetchDocumentos = useCallback(async () => {
    if (!processId) {
      setDocumentos([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.info(`Fetching document launches for process: ${processId}`, 'useDocumentoLancamentos');
      const data = await documentoLancamentoService.getByProcessId(processId);

      setDocumentos(data);
      logger.success(`Loaded ${data.length} document launches`, 'useDocumentoLancamentos');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch document launches';
      setError(errorMessage);
      logger.error(errorMessage, 'useDocumentoLancamentos');
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  const handleRealtimeInsert = useCallback((newDoc: DocumentoLancamento) => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    if (newDoc.processId === processId) {
      setDocumentos(prev => {
        if (prev.some(d => d.id === newDoc.id)) return prev;
        return [newDoc, ...prev];
      });
      logger.info('Realtime: Document inserted by another user', 'useDocumentoLancamentos');
    }
  }, [processId]);

  const handleRealtimeUpdate = useCallback((updatedDoc: DocumentoLancamento) => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    if (updatedDoc.processId === processId) {
      setDocumentos(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
      logger.info('Realtime: Document updated by another user', 'useDocumentoLancamentos');
    }
  }, [processId]);

  const handleRealtimeDelete = useCallback(({ id }: { id: string }) => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    setDocumentos(prev => prev.filter(d => d.id !== id));
    logger.info('Realtime: Document deleted by another user', 'useDocumentoLancamentos');
  }, []);

  useRealtimeSubscription<DocumentoLancamento>({
    table: 'lancamentos_documentos',
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete,
    enabled: !!processId
  });

  const createDocumento = async (input: DocumentoLancamentoCreateInput): Promise<DocumentoLancamento | null> => {
    try {
      setError(null);
      isLocalUpdate.current = true;
      logger.info('Creating new document launch', 'useDocumentoLancamentos.createDocumento');

      const newDocumento = await documentoLancamentoService.create(input);

      setDocumentos(prev => [newDocumento, ...prev]);
      logger.success(`Document launch created: ${newDocumento.id}`, 'useDocumentoLancamentos.createDocumento');

      return newDocumento;
    } catch (err) {
      isLocalUpdate.current = false;
      const errorMessage = err instanceof Error ? err.message : 'Failed to create document launch';
      setError(errorMessage);
      logger.error(errorMessage, 'useDocumentoLancamentos.createDocumento');
      return null;
    }
  };

  const updateDocumento = async (id: string, input: DocumentoLancamentoUpdateInput): Promise<DocumentoLancamento | null> => {
    try {
      setError(null);
      isLocalUpdate.current = true;
      logger.info(`Updating document launch: ${id}`, 'useDocumentoLancamentos.updateDocumento');

      const updatedDocumento = await documentoLancamentoService.update(id, input);

      setDocumentos(prev =>
        prev.map(doc => doc.id === id ? updatedDocumento : doc)
      );
      logger.success(`Document launch updated: ${id}`, 'useDocumentoLancamentos.updateDocumento');

      return updatedDocumento;
    } catch (err) {
      isLocalUpdate.current = false;
      const errorMessage = err instanceof Error ? err.message : 'Failed to update document launch';
      setError(errorMessage);
      logger.error(errorMessage, 'useDocumentoLancamentos.updateDocumento');
      return null;
    }
  };

  const deleteDocumento = async (id: string): Promise<boolean> => {
    try {
      setError(null);
      isLocalUpdate.current = true;
      logger.info(`Deleting document launch: ${id}`, 'useDocumentoLancamentos.deleteDocumento');

      await documentoLancamentoService.delete(id);

      setDocumentos(prev => prev.filter(doc => doc.id !== id));
      logger.success(`Document launch deleted: ${id}`, 'useDocumentoLancamentos.deleteDocumento');

      return true;
    } catch (err) {
      isLocalUpdate.current = false;
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document launch';
      setError(errorMessage);
      logger.error(errorMessage, 'useDocumentoLancamentos.deleteDocumento');
      return false;
    }
  };

  const refreshDocumentos = async (): Promise<void> => {
    await fetchDocumentos();
  };

  return {
    documentos,
    loading,
    error,
    createDocumento,
    updateDocumento,
    deleteDocumento,
    refreshDocumentos,
  };
};
