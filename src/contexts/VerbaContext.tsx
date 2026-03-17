import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Verba, VerbaLancamento, NewVerbaComLancamento, NewVerbaLancamento } from '../types/Verba';
import { logger, ValidationUtils, translateSupabaseError } from '../utils';
import { VerbasService } from '../services';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { logRealtimeEvent } from '../utils/domainLogger';

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
  refreshVerbasByProcess: (processId: string) => Promise<void>;
  importBackup: (backupData: Verba[]) => Promise<boolean>;
  exportBackup: () => string;
}

const VerbaContext = createContext<VerbaContextValue | null>(null);

interface VerbaProviderProps {
  children: ReactNode;
  activeProcessId?: string | null;
}

export const VerbaProvider: React.FC<VerbaProviderProps> = ({ children, activeProcessId }) => {
  const [cacheByProcess, setCacheByProcess] = useState<Map<string, Verba[]>>(new Map());
  const [loadedProcessIds, setLoadedProcessIds] = useState<Set<string>>(new Set());
  const [loadingProcessIds, setLoadingProcessIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeProcessIdRef = useRef<string | null | undefined>(activeProcessId);

  useEffect(() => {
    activeProcessIdRef.current = activeProcessId;
  }, [activeProcessId]);

  const loadVerbasByProcess = useCallback(async (processId: string) => {
    if (loadingProcessIds.has(processId)) return;

    setLoadingProcessIds(prev => new Set(prev).add(processId));
    try {
      setError(null);
      const data = await VerbasService.getByProcessId(processId);
      setCacheByProcess(prev => {
        const next = new Map(prev);
        next.set(processId, data);
        return next;
      });
      setLoadedProcessIds(prev => new Set(prev).add(processId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar verbas';
      setError(errorMessage);
      logger.errorWithException('Falha ao carregar verbas do processo', err as Error, 'VerbaContext', { processId });
    } finally {
      setLoadingProcessIds(prev => {
        const next = new Set(prev);
        next.delete(processId);
        return next;
      });
    }
  }, [loadingProcessIds]);

  useEffect(() => {
    if (activeProcessId && !loadedProcessIds.has(activeProcessId) && !loadingProcessIds.has(activeProcessId)) {
      loadVerbasByProcess(activeProcessId);
    }
  }, [activeProcessId, loadedProcessIds, loadingProcessIds, loadVerbasByProcess]);

  const verbas = useMemo((): Verba[] => {
    if (!activeProcessId) return [];
    return cacheByProcess.get(activeProcessId) || [];
  }, [activeProcessId, cacheByProcess]);

  const isLoading = useMemo((): boolean => {
    if (!activeProcessId) return false;
    return loadingProcessIds.has(activeProcessId);
  }, [activeProcessId, loadingProcessIds]);

  const refreshVerbasByProcess = useCallback(async (processId: string) => {
    setLoadedProcessIds(prev => {
      const next = new Set(prev);
      next.delete(processId);
      return next;
    });
    await loadVerbasByProcess(processId);
  }, [loadVerbasByProcess]);

  const refreshVerbas = useCallback(async () => {
    const pid = activeProcessIdRef.current;
    if (!pid) return;
    await refreshVerbasByProcess(pid);
  }, [refreshVerbasByProcess]);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      const pid = activeProcessIdRef.current;
      if (!pid) return;
      logRealtimeEvent('Realtime refresh requested', 'VerbaContext', 'refresh_requested', { table: 'verbas', processId: pid });
      try {
        const data = await VerbasService.getByProcessId(pid);
        setCacheByProcess(prev => {
          const next = new Map(prev);
          next.set(pid, data);
          return next;
        });
      } catch {
        logRealtimeEvent('Realtime refresh failed', 'VerbaContext', 'refresh_failed', { table: 'verbas' }, 'error');
      }
    }, 400);
  }, []);

  const realtimeFilter = useMemo(() =>
    activeProcessId ? `process_id=eq.${activeProcessId}` : undefined,
    [activeProcessId]
  );

  useRealtimeSubscription({
    table: 'verbas',
    filter: realtimeFilter,
    onAnyChange: debouncedRefresh,
    enabled: !!activeProcessId
  });

  useRealtimeSubscription({
    table: 'verba_lancamentos',
    onAnyChange: debouncedRefresh,
    enabled: !!activeProcessId
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
      const pid = novaVerba.processId;
      setCacheByProcess(prev => {
        const next = new Map(prev);
        const existing = next.get(pid) || [];
        const existingIndex = existing.findIndex(v => v.id === createdVerba.id);
        if (existingIndex >= 0) {
          const updated = [...existing];
          updated[existingIndex] = createdVerba;
          next.set(pid, updated);
        } else {
          next.set(pid, [createdVerba, ...existing]);
        }
        return next;
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
      setCacheByProcess(prev => {
        const next = new Map(prev);
        for (const [pid, verbas] of next.entries()) {
          const idx = verbas.findIndex(v => v.id === verbaId);
          if (idx >= 0) {
            const updated = [...verbas];
            updated[idx] = {
              ...updated[idx],
              lancamentos: updated[idx].lancamentos.map(l => l.id === lancamentoId ? updatedLancamento : l),
              dataAtualizacao: new Date()
            };
            next.set(pid, updated);
            break;
          }
        }
        return next;
      });
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
      await VerbasService.removeLancamento(verbaId, lancamentoId);

      setCacheByProcess(prev => {
        const next = new Map(prev);
        for (const [pid, verbas] of next.entries()) {
          const verba = verbas.find(v => v.id === verbaId);
          if (!verba) continue;
          const isLastLancamento = verba.lancamentos.length === 1;
          if (isLastLancamento) {
            next.set(pid, verbas.filter(v => v.id !== verbaId));
          } else {
            next.set(pid, verbas.map(v =>
              v.id === verbaId
                ? { ...v, lancamentos: v.lancamentos.filter(l => l.id !== lancamentoId), dataAtualizacao: new Date() }
                : v
            ));
          }
          break;
        }
        return next;
      });
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao remover';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const removeVerba = useCallback(async (verbaId: string, skipGlobalError = false): Promise<OperationResult> => {
    try {
      await VerbasService.removeVerba(verbaId);
      setCacheByProcess(prev => {
        const next = new Map(prev);
        for (const [pid, verbas] of next.entries()) {
          if (verbas.some(v => v.id === verbaId)) {
            next.set(pid, verbas.filter(v => v.id !== verbaId));
            break;
          }
        }
        return next;
      });
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
    for (const verbas of cacheByProcess.values()) {
      const found = verbas.find(v => v.id === id);
      if (found) return found;
    }
    return undefined;
  }, [cacheByProcess]);

  const getVerbasByProcess = useCallback((processId: string): Verba[] => {
    return cacheByProcess.get(processId) || [];
  }, [cacheByProcess]);

  const getLancamentoById = useCallback((verbaId: string, lancamentoId: string): VerbaLancamento | undefined => {
    const verba = getVerbaById(verbaId);
    return verba?.lancamentos.find(l => l.id === lancamentoId);
  }, [getVerbaById]);

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
          } catch (importErr) {
            logger.warn(
              `Ignorando entrada de backup duplicada ou inválida: ${verbaData.tipoVerba}`,
              'VerbaContext.importBackup',
              { error: importErr instanceof Error ? importErr.message : String(importErr) }
            );
          }
        }
      }
      const pid = activeProcessIdRef.current;
      if (pid) {
        const allVerbas = await VerbasService.getByProcessId(pid);
        setCacheByProcess(prev => {
          const next = new Map(prev);
          next.set(pid, allVerbas);
          return next;
        });
      }
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
    refreshVerbasByProcess,
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
    refreshVerbasByProcess,
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
