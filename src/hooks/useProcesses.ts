/**
 * Hook simplificado para gerenciamento de processos
 * 
 * Este hook foi refatorado para usar EXCLUSIVAMENTE o Supabase como backend,
 * removendo completamente qualquer dependência de armazenamento local.
 * Todas as operações são feitas diretamente no banco de dados em nuvem.
 * 
 * Funcionalidades:
 * - CRUD completo de processos via Supabase
 * - Validação automática de dados
 * - Tratamento robusto de erros
 * - Importação e exportação de backups
 * - Estatísticas em tempo real
 * - Logging detalhado de operações
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Process, NewProcess } from '../types/Process';
import { logger, ValidationUtils } from '../utils';
import { ProcessesService } from '../services';
import { testSupabaseConnection, isSupabaseAvailable } from '../lib/supabase.tsx';
import { useRealtimeSubscription } from './useRealtimeSubscription';

/**
 * Interface para estatísticas dos processos
 * Define a estrutura dos dados estatísticos retornados
 */
interface ProcessStats {
  total: number;                    // Total de processos no sistema
  recentes: number;                 // Processos criados na última semana
  porPeriodo: {                    // Distribuição temporal dos processos
    ultima_semana: number;         // Processos da última semana
    ultimo_mes: number;           // Processos do último mês  
    ultimo_ano: number;           // Processos do último ano
  };
}

/**
 * Hook personalizado para gerenciamento de processos com Supabase
 * 
 * Responsabilidades:
 * - Gerenciar estado dos processos carregados do Supabase
 * - Executar operações CRUD através do ProcessesService
 * - Manter sincronização com banco de dados em tempo real
 * - Fornecer feedback de loading e erros para a UI
 * - Calcular estatísticas e métricas dos dados
 */
export const useProcesses = () => {
  
  // ===== ESTADOS DO HOOK =====
  
  const [processes, setProcesses] = useState<Process[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pendingLocalOpsRef = useRef(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ===== FUNÇÕES DE CARREGAMENTO =====
  
  /**
   * Carrega todos os processos do Supabase
   * 
   * Esta função é responsável por buscar todos os processos
   * do banco de dados e atualizar o estado local. É usada tanto
   * no carregamento inicial quanto em recarregamentos manuais.
   * 
   * @returns Promise<void> - Não retorna dados, atualiza o estado
   */
  const loadProcesses = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const data = await ProcessesService.getAll();
      setProcesses(data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        setError('Erro de conectividade com Supabase. Verifique sua conexão de rede.');
        setProcesses([]);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar processos';
      setError(errorMessage);
      setProcesses([]);
      logger.error(errorMessage, 'useProcesses.loadProcesses');
    }
  }, []);

  /**
   * Inicialização do hook na montagem do componente
   *
   * Effect que executa uma única vez quando o hook é montado,
   * responsável por testar a conectividade e carregar dados iniciais
   */
  useEffect(() => {
    const initializeData = async () => {
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        setError('Timeout ao carregar processos. Tente recarregar a página.');
      }, 15000);

      try {
        const connected = await testSupabaseConnection();
        setIsConnected(connected);

        if (connected) {
          await loadProcesses();
        } else {
          if (!isSupabaseAvailable) {
            setError('Supabase não está configurado. Configure as variáveis de ambiente.');
          } else {
            setError('Não foi possível conectar ao Supabase. Verifique suas credenciais e conexão de rede.');
          }
          setProcesses([]);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          setError('Erro de conectividade com Supabase. Verifique sua conexão de rede.');
          setIsConnected(false);
          setProcesses([]);
        } else {
          setError('Erro crítico na inicialização do sistema');
          setProcesses([]);
          logger.error('Erro crítico na inicialização', 'useProcesses.initialization');
        }
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      if (pendingLocalOpsRef.current > 0) return;
      try {
        const data = await ProcessesService.getAll();
        setProcesses(data);
      } catch (_err) {
        // Silent fail for realtime refresh
      }
    }, 300);
  }, []);

  useRealtimeSubscription({
    table: 'processes',
    onAnyChange: debouncedRefresh,
    enabled: isConnected
  });

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const addProcess = useCallback(async (newProcess: NewProcess): Promise<boolean> => {
    const validation = ValidationUtils.validateNewProcess(newProcess);
    if (!validation.isValid) {
      setError(`Dados inválidos: ${Object.values(validation.errors).join(', ')}`);
      return false;
    }

    pendingLocalOpsRef.current += 1;
    try {
      await ProcessesService.create(newProcess);
      await loadProcesses();
      setError(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar processo no Supabase';
      setError(errorMessage);
      logger.error(errorMessage, 'useProcesses.addProcess');
      return false;
    } finally {
      pendingLocalOpsRef.current = Math.max(0, pendingLocalOpsRef.current - 1);
    }
  }, [loadProcesses]);

  /**
   * Atualiza um processo existente no Supabase
   * 
   * Fluxo completo:
   * 1. Verifica se o processo existe no estado local
   * 2. Valida os dados atualizados
   * 3. Atualiza no Supabase através do serviço
   * 4. Recarrega todos os processos para sincronizar
   * 
   * @param id - UUID do processo a ser atualizado
   * @param updatedData - Dados parciais para atualização
   * @returns Promise<boolean> - true se atualizado com sucesso
   */
  const updateProcess = useCallback(async (
    id: string,
    updatedData: Partial<NewProcess>
  ): Promise<boolean> => {
    const existingProcess = processes.find(p => p.id === id);
    if (!existingProcess) {
      setError(`Processo com ID ${id} não encontrado no estado atual`);
      return false;
    }

    const tempProcess = { ...existingProcess, ...updatedData };
    const validation = ValidationUtils.validateNewProcess(tempProcess);
    if (!validation.isValid) {
      setError(`Dados inválidos: ${Object.values(validation.errors).join(', ')}`);
      return false;
    }

    pendingLocalOpsRef.current += 1;
    try {
      await ProcessesService.update(id, updatedData);
      await loadProcesses();
      setError(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar processo no Supabase';
      setError(errorMessage);
      logger.error(errorMessage, 'useProcesses.updateProcess');
      return false;
    } finally {
      pendingLocalOpsRef.current = Math.max(0, pendingLocalOpsRef.current - 1);
    }
  }, [processes, loadProcesses]);

  /**
   * Remove um processo do Supabase
   * 
   * IMPORTANTE: Esta operação também remove automaticamente todas
   * as decisões e verbas vinculadas devido às constraints CASCADE do banco.
   * 
   * Fluxo completo:
   * 1. Verifica se o processo existe
   * 2. Remove do Supabase (CASCADE remove dados relacionados)
   * 3. Recarrega todos os processos para sincronizar
   * 
   * @param id - UUID do processo a ser removido
   * @returns Promise<boolean> - true se removido com sucesso
   */
  const getEmptyProcesses = useCallback(async (): Promise<Process[]> => {
    try {
      return await ProcessesService.getEmptyProcesses();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar processos vazios';
      setError(errorMessage);
      logger.error(errorMessage, 'useProcesses.getEmptyProcesses');
      return [];
    }
  }, []);

  const bulkRemoveProcesses = useCallback(async (
    ids: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<{ removed: number; failed: number }> => {
    let removed = 0;
    let failed = 0;
    const CHUNK_SIZE = 10;

    pendingLocalOpsRef.current += 1;
    try {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map(id => ProcessesService.delete(id))
        );
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            removed++;
          } else {
            failed++;
          }
        });
        onProgress?.(Math.min(i + CHUNK_SIZE, ids.length), ids.length);
      }
      await loadProcesses();
      setError(null);
    } finally {
      pendingLocalOpsRef.current = Math.max(0, pendingLocalOpsRef.current - 1);
    }
    return { removed, failed };
  }, [loadProcesses]);

  const removeProcess = useCallback(async (id: string): Promise<boolean> => {
    const processToRemove = processes.find(p => p.id === id);
    if (!processToRemove) {
      setError(`Processo com ID ${id} não encontrado no estado atual`);
      return false;
    }

    pendingLocalOpsRef.current += 1;
    try {
      await ProcessesService.delete(id);
      await loadProcesses();
      setError(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao remover processo do Supabase';
      setError(errorMessage);
      logger.error(errorMessage, 'useProcesses.removeProcess');
      return false;
    } finally {
      pendingLocalOpsRef.current = Math.max(0, pendingLocalOpsRef.current - 1);
    }
  }, [processes, loadProcesses]);

  // ===== OPERAÇÕES DE CONSULTA =====

  /**
   * Busca um processo específico por ID no estado atual
   * 
   * Esta função é otimizada com useMemo para evitar buscas
   * desnecessárias quando o estado não muda
   * 
   * @param id - UUID do processo procurado
   * @returns Process encontrado ou undefined se não existir
   */
  const getProcessById = useCallback((id: string): Process | undefined => {
    return processes.find(p => p.id === id);
  }, [processes]);

  /**
   * Busca processos por termo de pesquisa usando o Supabase
   * 
   * Utiliza a funcionalidade nativa de busca do Supabase para maior
   * eficiência e para aproveitar índices do banco de dados
   * 
   * @param searchTerm - Termo de busca para filtrar processos
   * @returns Promise<Process[]> - Array de processos que correspondem à busca
   */
  const searchProcesses = useCallback(async (searchTerm: string): Promise<Process[]> => {
    try {
      if (!searchTerm.trim()) {
        return processes;
      }

      setError(null);
      return await ProcessesService.search(searchTerm);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro na busca de processos';
      setError(errorMessage);
      logger.error(errorMessage, 'useProcesses.searchProcesses');
      return [];
    }
  }, [processes]);

  // ===== OPERAÇÕES DE BACKUP =====

  /**
   * Importa backup de processos diretamente para o Supabase
   * 
   * Esta função processa um array de processos de backup,
   * valida cada um e os salva diretamente no banco de dados.
   * Ignora processos duplicados (baseado no número do processo).
   * 
   * @param backupData - Array de processos do backup JSON
   * @returns Promise<boolean> - true se importado com sucesso
   */
  const importBackup = useCallback(async (backupData: Process[]): Promise<boolean> => {
    if (!Array.isArray(backupData)) {
      setError('Formato de backup inválido - deve ser um array de processos');
      return false;
    }

    if (backupData.length === 0) {
      setError('Backup está vazio - nenhum processo para importar');
      return false;
    }

    pendingLocalOpsRef.current += 1;
    try {
      for (let i = 0; i < backupData.length; i++) {
        const processData = backupData[i];
        const newProcessData: NewProcess = {
          numeroProcesso: processData.numeroProcesso,
          reclamante: processData.reclamante,
          reclamada: processData.reclamada,
          observacoesGerais: processData.observacoesGerais || ''
        };

        const validation = ValidationUtils.validateNewProcess(newProcessData);
        if (!validation.isValid) {
          setError(`Processo ${i + 1} (${processData.numeroProcesso}) inválido: ${Object.values(validation.errors).join(', ')}`);
          return false;
        }

        try {
          await ProcessesService.create(newProcessData);
        } catch (error) {
          if (!(error instanceof Error && error.message.includes('já existe'))) {
            throw error;
          }
        }
      }

      await loadProcesses();
      setError(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro na importação de backup';
      setError(errorMessage);
      logger.error(errorMessage, 'useProcesses.importBackup');
      return false;
    } finally {
      pendingLocalOpsRef.current = Math.max(0, pendingLocalOpsRef.current - 1);
    }
  }, [loadProcesses]);

  /**
   * Exporta backup dos processos atuais em formato JSON
   * 
   * Cria um backup estruturado dos processos carregados,
   * incluindo metadados para versionamento e auditoria.
   * 
   * @returns string - JSON formatado com dados do backup
   */
  const exportBackup = useCallback(() => {
    const backupData = {
      version: '1.0',
      source: 'supabase',
      timestamp: new Date().toISOString(),
      processCount: processes.length,
      processes: processes
    };
    return JSON.stringify(backupData, null, 2);
  }, [processes]);

  // ===== ESTATÍSTICAS CALCULADAS =====

  /**
   * Calcula estatísticas dos processos baseadas nos dados atuais
   * 
   * Utiliza useMemo para otimizar cálculos e evitar recalcular
   * quando os dados não mudaram
   * 
   * @returns ProcessStats - Objeto com estatísticas calculadas
   */
  const stats = useMemo((): ProcessStats => {
    if (processes.length === 0) {
      return {
        total: 0,
        recentes: 0,
        porPeriodo: {
          ultima_semana: 0,
          ultimo_mes: 0,
          ultimo_ano: 0
        }
      };
    }

    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    let ultima_semana = 0;
    let ultimo_mes = 0;
    let ultimo_ano = 0;

    for (const p of processes) {
      const age = now - p.dataCriacao.getTime();
      if (age <= oneWeekMs) {
        ultima_semana++;
        ultimo_mes++;
        ultimo_ano++;
      } else if (age <= oneMonthMs) {
        ultimo_mes++;
        ultimo_ano++;
      } else if (age <= oneYearMs) {
        ultimo_ano++;
      }
    }

    return {
      total: processes.length,
      recentes: ultima_semana,
      porPeriodo: { ultima_semana, ultimo_mes, ultimo_ano }
    };
  }, [processes]);

  // ===== UTILITÁRIOS =====

  /**
   * Força recarregamento manual dos processos do Supabase
   * 
   * Útil para refresh manual da interface ou após operações
   * externas que podem ter modificado os dados
   * 
   * @returns Promise<void> - Atualiza o estado interno
   */
  const refreshProcesses = useCallback(async () => {
    setIsLoading(true);
    await loadProcesses();
    setIsLoading(false);
  }, [loadProcesses]);

  /**
   * Retesta conectividade com Supabase
   * 
   * Permite verificar novamente se o Supabase está disponível,
   * útil após configuração ou correção de problemas de rede
   * 
   * @returns Promise<boolean> - true se conectado com sucesso
   */
  const retestConnection = useCallback(async (): Promise<boolean> => {
    try {
      const connected = await testSupabaseConnection();
      setIsConnected(connected);

      if (connected) {
        await loadProcesses();
      } else {
        setError('Não foi possível conectar ao Supabase');
      }

      return connected;
    } catch (error) {
      setIsConnected(false);
      setError('Erro ao testar conexão com Supabase');
      logger.error('Falha no teste de reconexão', 'useProcesses.retestConnection');
      return false;
    }
  }, [loadProcesses]);

  // ===== RETORNO DO HOOK =====

  return {
    // ===== ESTADO DOS DADOS =====
    processes,              // Lista atual de processos carregados do Supabase
    isLoading,             // Estado de carregamento para feedback na UI
    error,                 // Mensagem de erro atual (se houver)
    isConnected,           // Status de conectividade com Supabase
    stats,                 // Estatísticas calculadas dos processos

    // ===== OPERAÇÕES CRUD =====
    addProcess,            // Criar novo processo no Supabase
    updateProcess,         // Atualizar processo existente no Supabase
    removeProcess,         // Remover processo (e dados relacionados) do Supabase
    getEmptyProcesses,     // Buscar processos sem nenhum lançamento
    bulkRemoveProcesses,   // Remover múltiplos processos em lote

    // ===== OPERAÇÕES DE CONSULTA =====
    getProcessById,        // Buscar processo por ID no estado atual
    searchProcesses,       // Buscar processos por termo via Supabase

    // ===== BACKUP E IMPORTAÇÃO =====
    importBackup,          // Importar backup JSON para Supabase
    exportBackup,          // Exportar processos atuais como backup JSON

    // ===== UTILITÁRIOS =====
    loadProcesses,         // Carregar processos do Supabase manualmente  
    refreshProcesses,      // Forçar recarregamento com loading
    retestConnection       // Testar novamente conectividade com Supabase
  };
};