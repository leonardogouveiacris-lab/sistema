import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Verba, VerbaLancamento, NewVerbaComLancamento, NewVerbaLancamento } from '../types/Verba';
import { logger, ValidationUtils, translateSupabaseError } from '../utils';
import { VerbasService } from '../services';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

export interface OperationResult {
  success: boolean;
  error?: string;
}

interface VerbaContextValue {
  verbas: Verba[];
  isLoading: boolean;
  error: string | null;
  addVerbaComLancamento: (novaVerba: NewVerbaComLancamento, skipGlobalError?: boolean) => Promise<OperationResult>;
  updateVerbaLancamento: (verbaId: string, lancamentoId: string, updatedData: Partial<NewVerbaLancamento>, skipGlobalError?: boolean) => Promise<OperationResult>;
  removeVerbaLancamento: (verbaId: string, lancamentoId: string, skipGlobalError?: boolean) => Promise<OperationResult>;
  removeVerba: (verbaId: string, skipGlobalError?: boolean) => Promise<OperationResult>;
  getVerbaById: (id: string) => Verba | undefined;
  getVerbasByProcess: (processId: string) => Verba[];
  getLancamentoById: (verbaId: string, lancamentoId: string) => VerbaLancamento | undefined;
  refreshVerbas: () => Promise<void>;
  importBackup: (backupData: Verba[]) => Promise<boolean>;
  exportBackup: () => string;
}

const VerbaContext = createContext<VerbaContextValue | null>(null);

export const VerbaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [verbas, setVerbas] = useState<Verba[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshVerbas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await VerbasService.getAll();
      setVerbas(data);
      logger.info('Verbas recarregadas do Supabase', 'VerbaContext - refreshVerbas');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao recarregar';
      setError(errorMessage);
      logger.errorWithException('Falha ao recarregar verbas', err as Error, 'VerbaContext');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        setError('Timeout ao carregar verbas.');
        setVerbas([]);
      }, 15000);

      try {
        setIsLoading(true);
        setError(null);
        const data = await VerbasService.getAll();
        setVerbas(data);
        logger.success(`${data.length} verbas carregadas`, 'VerbaContext');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar';
        setError(errorMessage);
        setVerbas([]);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };
    loadInitial();
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      logger.info('Realtime: Refreshing verbas', 'VerbaContext');
      try {
        const data = await VerbasService.getAll();
        setVerbas(data);
      } catch (err) {
        logger.error('Realtime: Failed to refresh verbas', 'VerbaContext');
      }
    }, 100);
  }, []);

  useRealtimeSubscription({
    table: 'verbas',
    onAnyChange: debouncedRefresh,
    enabled: true
  });

  useRealtimeSubscription({
    table: 'verba_lancamentos',
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

  const addVerbaComLancamento = useCallback(async (novaVerba: NewVerbaComLancamento, skipGlobalError = false): Promise<OperationResult> => {
    try {
      const validation = ValidationUtils.validateNewVerbaComLancamento(novaVerba);
      if (!validation.isValid) {
        const errorMsg = `Dados inválidos: ${Object.values(validation.errors).join(', ')}`;
        if (!skipGlobalError) setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const createdVerba = await VerbasService.createVerbaComLancamento(novaVerba);
      setVerbas(prev => {
        const existingIndex = prev.findIndex(v => v.id === createdVerba.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = createdVerba;
          return updated;
        }
        return [createdVerba, ...prev];
      });
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao salvar verba';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const updateVerbaLancamento = useCallback(async (
    verbaId: string,
    lancamentoId: string,
    updatedData: Partial<NewVerbaLancamento>,
    skipGlobalError = false
  ): Promise<OperationResult> => {
    try {
      const updatedLancamento = await VerbasService.updateLancamento(verbaId, lancamentoId, updatedData);
      setVerbas(prev => prev.map(v =>
        v.id === verbaId
          ? {
              ...v,
              lancamentos: v.lancamentos.map(l => l.id === lancamentoId ? updatedLancamento : l),
              dataAtualizacao: new Date()
            }
          : v
      ));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao atualizar';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const removeVerbaLancamento = useCallback(async (verbaId: string, lancamentoId: string, skipGlobalError = false): Promise<OperationResult> => {
    try {
      const verba = verbas.find(v => v.id === verbaId);
      const isLastLancamento = verba ? verba.lancamentos.length === 1 : false;

      await VerbasService.removeLancamento(verbaId, lancamentoId);

      if (isLastLancamento) {
        setVerbas(prev => prev.filter(v => v.id !== verbaId));
      } else {
        setVerbas(prev => prev.map(v =>
          v.id === verbaId
            ? { ...v, lancamentos: v.lancamentos.filter(l => l.id !== lancamentoId), dataAtualizacao: new Date() }
            : v
        ));
      }
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao remover';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [verbas]);

  const removeVerba = useCallback(async (verbaId: string, skipGlobalError = false): Promise<OperationResult> => {
    try {
      await VerbasService.removeVerba(verbaId);
      setVerbas(prev => prev.filter(v => v.id !== verbaId));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao remover verba';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const getVerbaById = useCallback((id: string): Verba | undefined => {
    return verbas.find(v => v.id === id);
  }, [verbas]);

  const getVerbasByProcess = useCallback((processId: string): Verba[] => {
    return verbas.filter(v => v.processId === processId);
  }, [verbas]);

  const getLancamentoById = useCallback((verbaId: string, lancamentoId: string): VerbaLancamento | undefined => {
    const verba = verbas.find(v => v.id === verbaId);
    return verba?.lancamentos.find(l => l.id === lancamentoId);
  }, [verbas]);

  const importBackup = useCallback(async (backupData: Verba[]): Promise<boolean> => {
    try {
      if (!Array.isArray(backupData) || backupData.length === 0) {
        setError('Backup inválido');
        return false;
      }
      for (const verbaData of backupData) {
        for (const lancamento of verbaData.lancamentos) {
          const newVerbaData: NewVerbaComLancamento = {
            tipoVerba: verbaData.tipoVerba,
            processId: verbaData.processId,
            lancamento: {
              decisaoVinculada: lancamento.decisaoVinculada,
              situacao: lancamento.situacao,
              fundamentacao: lancamento.fundamentacao,
              comentariosCalculistas: lancamento.comentariosCalculistas
            }
          };
          try {
            await VerbasService.createVerbaComLancamento(newVerbaData);
          } catch {
          }
        }
      }
      const allVerbas = await VerbasService.getAll();
      setVerbas(allVerbas);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na importação';
      setError(errorMessage);
      return false;
    }
  }, []);

  const exportBackup = useMemo(() => (): string => {
    return JSON.stringify({
      version: '1.0',
      source: 'supabase',
      timestamp: new Date().toISOString(),
      verbasCount: verbas.length,
      verbas
    }, null, 2);
  }, [verbas]);

  const value = useMemo(() => ({
    verbas,
    isLoading,
    error,
    addVerbaComLancamento,
    updateVerbaLancamento,
    removeVerbaLancamento,
    removeVerba,
    getVerbaById,
    getVerbasByProcess,
    getLancamentoById,
    refreshVerbas,
    importBackup,
    exportBackup
  }), [
    verbas,
    isLoading,
    error,
    addVerbaComLancamento,
    updateVerbaLancamento,
    removeVerbaLancamento,
    removeVerba,
    getVerbaById,
    getVerbasByProcess,
    getLancamentoById,
    refreshVerbas,
    importBackup,
    exportBackup
  ]);

  return <VerbaContext.Provider value={value}>{children}</VerbaContext.Provider>;
};

export const useVerbaContext = (): VerbaContextValue => {
  const context = useContext(VerbaContext);
  if (!context) {
    throw new Error('useVerbaContext must be used within VerbaProvider');
  }
  return context;
};
