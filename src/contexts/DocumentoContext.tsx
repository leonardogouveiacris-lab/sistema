import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Documento, NewDocumento } from '../types/Documento';
import { logger, translateSupabaseError } from '../utils';
import { DocumentosService } from '../services';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { logRealtimeEvent } from '../utils/domainLogger';
import type { OperationResult } from '../types/Common';

export type { OperationResult };

interface DocumentoContextValue {
  documentos: Documento[];
  isLoading: boolean;
  error: string | null;
  addDocumento: (newDocumento: NewDocumento, skipGlobalError?: boolean) => Promise<OperationResult>;
  updateDocumento: (id: string, updatedData: Partial<NewDocumento>, skipGlobalError?: boolean) => Promise<OperationResult>;
  removeDocumento: (id: string, skipGlobalError?: boolean) => Promise<OperationResult>;
  renameTipoDocumento: (oldTipo: string, newTipo: string, skipGlobalError?: boolean) => Promise<OperationResult>;
  toggleDocumentoCheck: (documentoId: string, field: 'calculista' | 'revisor', value: boolean) => Promise<void>;
  getDocumentoById: (id: string) => Documento | undefined;
  getDocumentosByProcess: (processId: string) => Documento[];
  refreshDocumentos: () => Promise<void>;
}

const DocumentoContext = createContext<DocumentoContextValue | null>(null);

export const DocumentoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const refreshDocumentos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DocumentosService.getAll();
      setDocumentos(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao recarregar';
      setError(errorMessage);
      logger.errorWithException('Falha ao recarregar documentos', err as Error, 'DocumentoContext');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled && isMountedRef.current) {
        setIsLoading(false);
        setError('Timeout ao carregar documentos.');
      }
    }, 15000);

    const loadInitial = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await DocumentosService.getAll();
        settled = true;
        if (isMountedRef.current) {
          setDocumentos(data);
        }
      } catch (err) {
        settled = true;
        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar';
          setError(errorMessage);
          setDocumentos([]);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      logRealtimeEvent('Realtime refresh requested', 'DocumentoContext', 'refresh_requested', { table: 'documentos' });
      try {
        const data = await DocumentosService.getAll();
        setDocumentos(data);
      } catch {
        logRealtimeEvent('Realtime refresh failed', 'DocumentoContext', 'refresh_failed', { table: 'documentos' }, 'error');
      }
    }, 400);
  }, []);

  useRealtimeSubscription({
    table: 'lancamentos_documentos',
    onAnyChange: debouncedRefresh,
    enabled: true
  });

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const addDocumento = useCallback(async (newDocumento: NewDocumento, skipGlobalError = false): Promise<OperationResult> => {
    try {
      if (!newDocumento.tipoDocumento?.trim()) {
        const errorMsg = 'Tipo de documento é obrigatório';
        if (!skipGlobalError) setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!newDocumento.processId?.trim()) {
        const errorMsg = 'ID do processo é obrigatório';
        if (!skipGlobalError) setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const createdDocumento = await DocumentosService.create(newDocumento);
      setDocumentos(prev => [createdDocumento, ...prev]);
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao salvar documento';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const updateDocumento = useCallback(async (id: string, updatedData: Partial<NewDocumento>, skipGlobalError = false): Promise<OperationResult> => {
    try {
      const updatedDocumento = await DocumentosService.update(id, updatedData);
      setDocumentos(prev => prev.map(d => d.id === id ? updatedDocumento : d));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao atualizar';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const removeDocumento = useCallback(async (id: string, skipGlobalError = false): Promise<OperationResult> => {
    try {
      await DocumentosService.delete(id);
      setDocumentos(prev => prev.filter(d => d.id !== id));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao remover';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const renameTipoDocumento = useCallback(async (oldTipo: string, newTipo: string, skipGlobalError = false): Promise<OperationResult> => {
    try {
      await DocumentosService.bulkUpdateTipo(oldTipo, newTipo);
      setDocumentos(prev => prev.map(d => d.tipoDocumento === oldTipo ? { ...d, tipoDocumento: newTipo } : d));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao renomear tipo de documento';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const toggleDocumentoCheck = useCallback(async (documentoId: string, field: 'calculista' | 'revisor', value: boolean): Promise<void> => {
    try {
      const updatedDocumento = await DocumentosService.toggleCheck(documentoId, field, value);
      setDocumentos(prev => prev.map(d => d.id === documentoId ? updatedDocumento : d));
    } catch (err) {
      logger.errorWithException(`Falha ao alternar check ${field} do documento`, err as Error, 'DocumentoContext.toggleDocumentoCheck');
    }
  }, []);

  const getDocumentoById = useCallback((id: string): Documento | undefined => {
    return documentos.find(d => d.id === id);
  }, [documentos]);

  const getDocumentosByProcess = useCallback((processId: string): Documento[] => {
    return documentos.filter(d => d.processId === processId);
  }, [documentos]);

  const value = useMemo(() => ({
    documentos,
    isLoading,
    error,
    addDocumento,
    updateDocumento,
    removeDocumento,
    renameTipoDocumento,
    toggleDocumentoCheck,
    getDocumentoById,
    getDocumentosByProcess,
    refreshDocumentos
  }), [
    documentos,
    isLoading,
    error,
    addDocumento,
    updateDocumento,
    removeDocumento,
    renameTipoDocumento,
    toggleDocumentoCheck,
    getDocumentoById,
    getDocumentosByProcess,
    refreshDocumentos
  ]);

  return <DocumentoContext.Provider value={value}>{children}</DocumentoContext.Provider>;
};

export const useDocumentoContext = (): DocumentoContextValue => {
  const context = useContext(DocumentoContext);
  if (!context) {
    throw new Error('useDocumentoContext must be used within DocumentoProvider');
  }
  return context;
};
