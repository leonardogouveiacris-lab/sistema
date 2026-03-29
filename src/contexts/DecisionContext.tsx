import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Decision, NewDecision } from '../types/Decision';
import { logger, ValidationUtils, translateSupabaseError } from '../utils';
import { DecisionsService } from '../services';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { logRealtimeEvent } from '../utils/domainLogger';
import type { OperationResult } from '../types/Common';

export type { OperationResult };

interface DecisionContextValue {
  decisions: Decision[];
  isLoading: boolean;
  error: string | null;
  addDecision: (newDecision: NewDecision, skipGlobalError?: boolean) => Promise<OperationResult>;
  updateDecision: (id: string, updatedData: Partial<NewDecision>, skipGlobalError?: boolean) => Promise<OperationResult>;
  removeDecision: (id: string, skipGlobalError?: boolean) => Promise<OperationResult>;
  getDecisionById: (id: string) => Decision | undefined;
  getDecisionsByProcess: (processId: string) => Decision[];
  refreshDecisions: () => Promise<void>;
  importBackup: (backupData: Decision[]) => Promise<boolean>;
  exportBackup: () => string;
}

const DecisionContext = createContext<DecisionContextValue | null>(null);

export const DecisionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const refreshDecisions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DecisionsService.getAll();
      setDecisions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao recarregar';
      setError(errorMessage);
      logger.errorWithException('Falha ao recarregar decisões', err as Error, 'DecisionContext');
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
        setError('Timeout ao carregar decisões.');
      }
    }, 15000);

    const loadInitial = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await DecisionsService.getAll();
        settled = true;
        if (isMountedRef.current) {
          setDecisions(data);
        }
      } catch (err) {
        settled = true;
        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar';
          setError(errorMessage);
          setDecisions([]);
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
      logRealtimeEvent('Realtime refresh requested', 'DecisionContext', 'refresh_requested', { table: 'decisions' });
      try {
        const data = await DecisionsService.getAll();
        setDecisions(data);
      } catch {
        logRealtimeEvent('Realtime refresh failed', 'DecisionContext', 'refresh_failed', { table: 'decisions' }, 'error');
      }
    }, 400);
  }, []);

  useRealtimeSubscription({
    table: 'decisions',
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

  const addDecision = useCallback(async (newDecision: NewDecision, skipGlobalError = false): Promise<OperationResult> => {
    try {
      const validation = ValidationUtils.validateNewDecision(newDecision);
      if (!validation.isValid) {
        const errorMsg = `Dados inválidos: ${Object.values(validation.errors).join(', ')}`;
        if (!skipGlobalError) setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const createdDecision = await DecisionsService.create(newDecision);
      setDecisions(prev => [createdDecision, ...prev]);
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao salvar decisão';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const updateDecision = useCallback(async (id: string, updatedData: Partial<NewDecision>, skipGlobalError = false): Promise<OperationResult> => {
    try {
      const updatedDecision = await DecisionsService.update(id, updatedData);
      setDecisions(prev => prev.map(d => d.id === id ? updatedDecision : d));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao atualizar';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const removeDecision = useCallback(async (id: string, skipGlobalError = false): Promise<OperationResult> => {
    try {
      await DecisionsService.delete(id);
      setDecisions(prev => prev.filter(d => d.id !== id));
      setError(null);
      return { success: true };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro ao remover';
      const errorMessage = translateSupabaseError(rawMessage);
      if (!skipGlobalError) setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const getDecisionById = useCallback((id: string): Decision | undefined => {
    return decisions.find(d => d.id === id);
  }, [decisions]);

  const getDecisionsByProcess = useCallback((processId: string): Decision[] => {
    return decisions.filter(d => d.processId === processId);
  }, [decisions]);

  const importBackup = useCallback(async (backupData: Decision[]): Promise<boolean> => {
    try {
      if (!Array.isArray(backupData) || backupData.length === 0) {
        setError('Backup inválido');
        return false;
      }
      for (const decisionData of backupData) {
        const newDecisionData: NewDecision = {
          processId: decisionData.processId,
          tipoDecisao: decisionData.tipoDecisao,
          idDecisao: decisionData.idDecisao,
          situacao: decisionData.situacao,
          observacoes: decisionData.observacoes
        };
        try {
          await DecisionsService.create(newDecisionData);
        } catch (importErr) {
          logger.warn(
            `Ignorando entrada de backup duplicada ou inválida: ${decisionData.idDecisao}`,
            'DecisionContext.importBackup',
            { error: importErr instanceof Error ? importErr.message : String(importErr) }
          );
        }
      }
      const allDecisions = await DecisionsService.getAll();
      setDecisions(allDecisions);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na importação';
      setError(errorMessage);
      return false;
    }
  }, []);

  const exportBackup = useCallback((): string => {
    return JSON.stringify({
      version: '1.0',
      source: 'supabase',
      timestamp: new Date().toISOString(),
      decisionCount: decisions.length,
      decisions
    }, null, 2);
  }, [decisions]);

  const value = useMemo(() => ({
    decisions,
    isLoading,
    error,
    addDecision,
    updateDecision,
    removeDecision,
    getDecisionById,
    getDecisionsByProcess,
    refreshDecisions,
    importBackup,
    exportBackup
  }), [
    decisions,
    isLoading,
    error,
    addDecision,
    updateDecision,
    removeDecision,
    getDecisionById,
    getDecisionsByProcess,
    refreshDecisions,
    importBackup,
    exportBackup
  ]);

  return <DecisionContext.Provider value={value}>{children}</DecisionContext.Provider>;
};

export const useDecisionContext = (): DecisionContextValue => {
  const context = useContext(DecisionContext);
  if (!context) {
    throw new Error('useDecisionContext must be used within DecisionProvider');
  }
  return context;
};
