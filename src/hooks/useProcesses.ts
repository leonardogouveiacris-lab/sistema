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
  const isLocalUpdate = useRef(false);
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
      logger.info('Iniciando carregamento de processos do Supabase...', 'useProcesses - loadProcesses');
      setError(null);
      
      // Busca todos os processos através do serviço
      const data = await ProcessesService.getAll();
      
      // Atualiza o estado com os dados carregados
      setProcesses(data);
      
      logger.success(
        `${data.length} processos carregados do Supabase com sucesso`,
        'useProcesses - loadProcesses',
        { processCount: data.length }
      );
      
    } catch (error) {
      // Trata especificamente erros de conectividade
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        setError('Erro de conectividade com Supabase. Verifique sua conexão de rede.');
        setProcesses([]);
        logger.warn('Falha de conectividade ao carregar processos', 'useProcesses - loadProcesses');
        return;
      }
      
      // Em caso de erro, limpa os processos e define mensagem de erro
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar processos';
      setError(errorMessage);
      setProcesses([]); // Limpa lista em caso de erro
      
      logger.errorWithException(
        'Falha ao carregar processos do Supabase',
        error as Error,
        'useProcesses - loadProcesses'
      );
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
      // Timeout de segurança para evitar loading infinito
      const timeoutId = setTimeout(() => {
        logger.warn('Timeout na inicialização do useProcesses', 'useProcesses - initialization');
        setIsLoading(false);
        setError('Timeout ao carregar processos. Tente recarregar a página.');
      }, 15000); // 15 segundos de timeout

      try {
        logger.info('Inicializando hook useProcesses...', 'useProcesses - initialization');

        // Testa conectividade com Supabase
        const connected = await testSupabaseConnection();
        setIsConnected(connected);

        if (connected) {
          // Se conectado, carrega os processos
          await loadProcesses();
        } else {
          // Se não conectado, verifica se é problema de configuração ou conectividade
          if (!isSupabaseAvailable) {
            setError('Supabase não está configurado. Configure as variáveis de ambiente.');
          } else {
            setError('Não foi possível conectar ao Supabase. Verifique suas credenciais e conexão de rede.');
          }
          // Define lista vazia para permitir navegação da UI
          setProcesses([]);
          logger.warn('Supabase não disponível durante inicialização', 'useProcesses - initialization');
        }

      } catch (error) {
        // Trata erros específicos de conectividade
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          setError('Erro de conectividade com Supabase. Verifique sua conexão de rede.');
          setIsConnected(false);
          setProcesses([]);
          logger.warn('Falha de conectividade durante inicialização', 'useProcesses - initialization');
        } else {
          // Erro crítico na inicialização
          setError('Erro crítico na inicialização do sistema');
          setProcesses([]);
          logger.errorWithException(
            'Erro crítico na inicialização do hook useProcesses',
            error as Error,
            'useProcesses - initialization'
          );
        }
      } finally {
        // Limpa o timeout e sempre para o loading
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      logger.info('Realtime: Refreshing processes due to external change', 'useProcesses');
      try {
        const data = await ProcessesService.getAll();
        setProcesses(data);
      } catch (err) {
        logger.error('Realtime: Failed to refresh processes', 'useProcesses');
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
    try {
      logger.info(
        `Iniciando criação de processo: ${newProcess.numeroProcesso}`,
        'useProcesses - addProcess',
        { numeroProcesso: newProcess.numeroProcesso, reclamante: newProcess.reclamante }
      );

      // Validação prévia dos dados usando utilitário centralizado
      const validation = ValidationUtils.validateNewProcess(newProcess);
      if (!validation.isValid) {
        const errorMessage = `Dados inválidos: ${Object.values(validation.errors).join(', ')}`;
        setError(errorMessage);
        logger.warn('Validação de processo falhou', 'useProcesses - addProcess', { errors: validation.errors });
        return false;
      }

      isLocalUpdate.current = true;
      const createdProcess = await ProcessesService.create(newProcess);
      
      // Recarregamento completo para garantir sincronização
      await loadProcesses();
      
      // Limpa erro e sinaliza sucesso
      setError(null);

      logger.success(
        `Processo "${createdProcess.numeroProcesso}" criado com sucesso no Supabase`,
        'useProcesses - addProcess',
        { 
          processId: createdProcess.id, 
          numeroProcesso: createdProcess.numeroProcesso,
          reclamante: createdProcess.reclamante 
        }
      );
      
      return true;
      
    } catch (error) {
      // Tratamento de erro com mensagem amigável
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar processo no Supabase';
      setError(errorMessage);
      
      logger.errorWithException(
        'Falha ao criar processo no Supabase',
        error as Error,
        'useProcesses - addProcess',
        { newProcess }
      );
      
      return false;
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
    try {
      logger.info(
        `Iniciando atualização de processo: ${id}`,
        'useProcesses - updateProcess',
        { processId: id, fieldsToUpdate: Object.keys(updatedData) }
      );

      // Verifica se o processo existe no estado atual
      const existingProcess = processes.find(p => p.id === id);
      if (!existingProcess) {
        const errorMessage = `Processo com ID ${id} não encontrado no estado atual`;
        setError(errorMessage);
        logger.warn('Processo não encontrado para atualização', 'useProcesses - updateProcess', { id });
        return false;
      }
      
      // Validação dos dados combinados (existentes + atualizações)
      const tempProcess = { ...existingProcess, ...updatedData };
      const validation = ValidationUtils.validateNewProcess(tempProcess);
      if (!validation.isValid) {
        const errorMessage = `Dados inválidos: ${Object.values(validation.errors).join(', ')}`;
        setError(errorMessage);
        logger.warn('Validação de atualização falhou', 'useProcesses - updateProcess', { errors: validation.errors });
        return false;
      }

      isLocalUpdate.current = true;
      const updatedProcess = await ProcessesService.update(id, updatedData);
      
      // Recarregamento completo para sincronizar com outras possíveis mudanças
      await loadProcesses();
      
      // Limpa erro e sinaliza sucesso
      setError(null);
      
      logger.success(
        `Processo "${updatedProcess.numeroProcesso}" atualizado com sucesso no Supabase`,
        'useProcesses - updateProcess',
        { 
          processId: id, 
          numeroProcesso: updatedProcess.numeroProcesso,
          changedFields: Object.keys(updatedData) 
        }
      );
      
      return true;
      
    } catch (error) {
      // Tratamento de erro específico
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar processo no Supabase';
      setError(errorMessage);
      
      logger.errorWithException(
        'Falha ao atualizar processo no Supabase',
        error as Error,
        'useProcesses - updateProcess',
        { id, updatedData }
      );
      
      return false;
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
  const removeProcess = useCallback(async (id: string): Promise<boolean> => {
    try {
      logger.info(`Iniciando remoção de processo: ${id}`, 'useProcesses - removeProcess');

      // Busca informações do processo para logging (antes da remoção)
      const processToRemove = processes.find(p => p.id === id);
      if (!processToRemove) {
        const errorMessage = `Processo com ID ${id} não encontrado no estado atual`;
        setError(errorMessage);
        logger.warn('Processo não encontrado para remoção', 'useProcesses - removeProcess', { id });
        return false;
      }

      isLocalUpdate.current = true;
      await ProcessesService.delete(id);
      
      // Recarregamento completo para refletir todas as mudanças (incluindo CASCADE)
      await loadProcesses();
      
      // Limpa erro e sinaliza sucesso
      setError(null);
      
      logger.success(
        `Processo "${processToRemove.numeroProcesso}" e todos dados relacionados removidos do Supabase`,
        'useProcesses - removeProcess',
        { 
          processId: id, 
          numeroProcesso: processToRemove.numeroProcesso,
          reclamante: processToRemove.reclamante
        }
      );
      
      return true;
      
    } catch (error) {
      // Tratamento de erro com contexto
      const errorMessage = error instanceof Error ? error.message : 'Erro ao remover processo do Supabase';
      setError(errorMessage);
      
      logger.errorWithException(
        'Falha ao remover processo do Supabase',
        error as Error,
        'useProcesses - removeProcess',
        { id }
      );
      
      return false;
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
    const process = processes.find(p => p.id === id);
    
    if (process) {
      logger.info(
        `Processo encontrado no estado local: ${process.numeroProcesso}`,
        'useProcesses - getProcessById',
        { processId: id }
      );
    }
    
    return process;
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
      logger.info(
        `Executando busca de processos: "${searchTerm}"`,
        'useProcesses - searchProcesses',
        { searchTerm, connectedToSupabase: isConnected }
      );
      
      // Se não há termo de busca, retorna lista atual
      if (!searchTerm.trim()) {
        logger.info('Termo de busca vazio, retornando lista completa', 'useProcesses - searchProcesses');
        return processes;
      }
      
      // Sempre usa busca do Supabase para resultados mais eficientes
      setError(null);
      const results = await ProcessesService.search(searchTerm);
      
      logger.success(
        `Busca concluída: ${results.length} processos encontrados para "${searchTerm}"`,
        'useProcesses - searchProcesses',
        { searchTerm, resultsCount: results.length }
      );
      
      return results;
      
    } catch (error) {
      // Em caso de erro, define mensagem e retorna array vazio
      const errorMessage = error instanceof Error ? error.message : 'Erro na busca de processos';
      setError(errorMessage);
      
      logger.errorWithException(
        'Falha na busca de processos via Supabase',
        error as Error,
        'useProcesses - searchProcesses',
        { searchTerm }
      );
      
      return []; // Retorna lista vazia em caso de erro
    }
  }, [processes, isConnected]);

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
    try {
      logger.info(
        `Iniciando importação de backup: ${backupData.length} processos`,
        'useProcesses - importBackup',
        { totalProcesses: backupData.length }
      );

      // Validação básica do formato do backup
      if (!Array.isArray(backupData)) {
        const errorMessage = 'Formato de backup inválido - deve ser um array de processos';
        setError(errorMessage);
        logger.warn('Formato de backup inválido', 'useProcesses - importBackup', { dataType: typeof backupData });
        return false;
      }

      if (backupData.length === 0) {
        const errorMessage = 'Backup está vazio - nenhum processo para importar';
        setError(errorMessage);
        logger.warn('Backup vazio fornecido', 'useProcesses - importBackup');
        return false;
      }

      // Contadores para relatório de importação
      const importedProcesses: Process[] = [];
      const skippedProcesses: string[] = [];
      
      // Processa cada processo do backup individualmente
      for (let i = 0; i < backupData.length; i++) {
        const processData = backupData[i];
        
        // Converte para formato NewProcess (remove campos gerados automaticamente)
        const newProcessData: NewProcess = {
          numeroProcesso: processData.numeroProcesso,
          reclamante: processData.reclamante,
          reclamada: processData.reclamada,
          observacoesGerais: processData.observacoesGerais || ''
        };

        // Validação individual de cada processo
        const validation = ValidationUtils.validateNewProcess(newProcessData);
        if (!validation.isValid) {
          const errorMessage = `Processo ${i + 1} (${processData.numeroProcesso}) inválido: ${Object.values(validation.errors).join(', ')}`;
          setError(errorMessage);
          logger.warn('Processo inválido no backup', 'useProcesses - importBackup', { 
            index: i, 
            numeroProcesso: processData.numeroProcesso, 
            errors: validation.errors 
          });
          return false;
        }

        // Tentativa de criação no Supabase
        try {
          const createdProcess = await ProcessesService.create(newProcessData);
          importedProcesses.push(createdProcess);
          
          logger.info(
            `Processo importado: ${createdProcess.numeroProcesso}`,
            'useProcesses - importBackup',
            { index: i, processId: createdProcess.id }
          );
          
        } catch (error) {
          // Ignora processos duplicados (número já existe)
          if (error instanceof Error && error.message.includes('já existe')) {
            skippedProcesses.push(newProcessData.numeroProcesso);
            logger.info(
              `Processo duplicado ignorado: ${newProcessData.numeroProcesso}`,
              'useProcesses - importBackup',
              { index: i, numeroProcesso: newProcessData.numeroProcesso }
            );
          } else {
            // Para outros tipos de erro, propaga a exceção
            throw error;
          }
        }
      }

      // Recarregamento completo após importação para sincronizar
      await loadProcesses();
      setError(null);
      
      // Log consolidado do resultado da importação
      logger.success(
        `Importação de backup concluída com sucesso`,
        'useProcesses - importBackup',
        { 
          totalInBackup: backupData.length,
          imported: importedProcesses.length, 
          skipped: skippedProcesses.length,
          skippedNumbers: skippedProcesses
        }
      );
      
      return true;
      
    } catch (error) {
      // Erro geral da importação
      const errorMessage = error instanceof Error ? error.message : 'Erro na importação de backup';
      setError(errorMessage);
      
      logger.errorWithException(
        'Falha crítica na importação de backup',
        error as Error,
        'useProcesses - importBackup',
        { backupDataLength: backupData.length }
      );
      
      return false;
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
    // Estrutura completa do backup com metadados
    const backupData = {
      version: '1.0',                          // Versão do formato de backup
      source: 'supabase',                      // Fonte dos dados
      timestamp: new Date().toISOString(),     // Timestamp da exportação
      processCount: processes.length,          // Quantidade de processos
      processes: processes                     // Dados dos processos
    };

    // Log da operação de exportação
    logger.success(
      `Backup de processos exportado: ${processes.length} processos`,
      'useProcesses - exportBackup',
      { processCount: processes.length, backupSize: JSON.stringify(backupData).length }
    );
    
    // Retorna JSON formatado para download
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
    logger.info(
      'Calculando estatísticas dos processos',
      'useProcesses - stats',
      { totalProcesses: processes.length }
    );

    // Se não há processos, retorna estatísticas zeradas
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
    
    // Cálculo das datas de referência para os períodos
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Cálculo das estatísticas por período
    const statsCalculadas = {
      total: processes.length,
      recentes: processes.filter(p => p.dataCriacao >= oneWeekAgo).length,
      porPeriodo: {
        ultima_semana: processes.filter(p => p.dataCriacao >= oneWeekAgo).length,
        ultimo_mes: processes.filter(p => p.dataCriacao >= oneMonthAgo).length,
        ultimo_ano: processes.filter(p => p.dataCriacao >= oneYearAgo).length
      }
    };

    logger.success(
      'Estatísticas calculadas',
      'useProcesses - stats',
      statsCalculadas
    );

    return statsCalculadas;
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
    logger.info('Recarregamento manual de processos solicitado', 'useProcesses - refreshProcesses');
    
    setIsLoading(true);
    await loadProcesses();
    setIsLoading(false);
    
    logger.success('Recarregamento manual de processos concluído', 'useProcesses - refreshProcesses');
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
      logger.info('Retestando conectividade com Supabase...', 'useProcesses - retestConnection');
      
      const connected = await testSupabaseConnection();
      setIsConnected(connected);
      
      if (connected) {
        // Se reconectou, carrega os processos
        await loadProcesses();
      } else {
        setError('Não foi possível conectar ao Supabase');
      }
      
      logger.info(
        `Teste de reconexão ${connected ? 'bem-sucedido' : 'falhou'}`,
        'useProcesses - retestConnection',
        { connected }
      );
      
      return connected;
      
    } catch (error) {
      setIsConnected(false);
      const errorMessage = 'Erro ao testar conexão com Supabase';
      setError(errorMessage);
      
      logger.errorWithException(
        'Falha no teste de reconexão',
        error as Error,
        'useProcesses - retestConnection'
      );
      
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