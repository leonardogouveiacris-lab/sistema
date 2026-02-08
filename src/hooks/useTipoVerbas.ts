/**
 * Hook Simplificado para Gerenciamento de Tipos de Verba
 * 
 * Este hook foi completamente refatorado para ser mais simples e focado.
 * Responsabilidades claras:
 * 
 * 1. Carregar tipos disponíveis
 * 2. Criar novos tipos
 * 3. Executar renomeação
 * 4. Validar tipos
 * 5. Gerenciar cache
 * 
 * REMOVIDO: Lógica complexa e redundante dos hooks anteriores
 * FOCO: Interface limpa e operações diretas
 */

import { useState, useCallback, useEffect } from 'react';
import { TipoVerbaService, CreateTipoResult, TipoStats } from '../services/tipoVerba.service';
import { RenameService, RenameResult } from '../services/rename.service';
import { TipoVerbaNormalizer } from '../utils/tipoVerbaNormalizer';
import { logger } from '../utils';

/**
 * Interface de retorno do hook simplificado
 */
interface UseTipoVerbasReturn {
  // Estado
  tipos: string[];
  isLoading: boolean;
  error: string | null;
  
  // Operações principais
  carregarTipos: (processId?: string) => Promise<void>;
  criarTipo: (tipo: string, processId?: string) => Promise<CreateTipoResult>;
  renomearTipo: (tipoAntigo: string, tipoNovo: string, processId?: string) => Promise<RenameResult>;
  
  // Utilitários
  validarTipo: (tipo: string) => { isValid: boolean; errorMessage?: string };
  obterEstatisticas: (tipo: string) => Promise<TipoStats>;
  forcarRecarregamento: () => Promise<void>;
}

/**
 * Hook simplificado para tipos de verba dinâmicos
 * 
 * Foco na simplicidade e clareza. Remove toda a complexidade
 * dos hooks anteriores mantendo apenas o essencial.
 * 
 * @param processId - ID do processo para carregamento contextualizado
 * @returns Funções e estados para gerenciar tipos de verba
 */
export const useTipoVerbas = (processId?: string): UseTipoVerbasReturn => {
  
  // ===== ESTADOS SIMPLES =====
  const [tipos, setTipos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===== FUNÇÃO PRINCIPAL: CARREGAR TIPOS =====
  
  /**
   * Carrega tipos do banco de dados
   * 
   * Função principal que busca todos os tipos disponíveis
   * e atualiza o estado do hook.
   * 
   * @param processId - ID do processo (opcional) para contexto específico
   */
  const carregarTipos = useCallback(async (processId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      logger.info(
        `Carregando tipos via hook ${processId ? `para processo ${processId}` : 'globalmente'}`,
        'useTipoVerbas.carregarTipos',
        { processId }
      );

      // Usa o serviço principal para buscar tipos
      const tiposCarregados = await TipoVerbaService.getTiposDistintos(processId);
      
      setTipos(tiposCarregados);

      logger.success(
        `${tiposCarregados.length} tipos carregados via hook`,
        'useTipoVerbas.carregarTipos',
        { processId, count: tiposCarregados.length }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar tipos';
      setError(errorMessage);

      logger.errorWithException(
        'Erro ao carregar tipos via hook',
        error as Error,
        'useTipoVerbas.carregarTipos',
        { processId }
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===== OPERAÇÕES DE GERENCIAMENTO =====

  /**
   * Cria um novo tipo personalizado
   * 
   * @param tipo - Novo tipo a ser criado
   * @param processId - ID do processo criador (opcional)
   * @returns Resultado da operação
   */
  const criarTipo = useCallback(async (
    tipo: string,
    processId?: string
  ): Promise<CreateTipoResult> => {
    try {
      setError(null);

      logger.info(
        `Criando tipo via hook: "${tipo}"`,
        'useTipoVerbas.criarTipo',
        { tipo, processId }
      );

      // Usa o serviço principal para criar
      const resultado = await TipoVerbaService.criarTipo(tipo, processId);

      if (resultado.success) {
        // Recarrega tipos após criar
        await carregarTipos(processId);
      }

      return resultado;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar tipo';
      setError(errorMessage);

      logger.errorWithException(
        'Erro ao criar tipo via hook',
        error as Error,
        'useTipoVerbas.criarTipo',
        { tipo, processId }
      );

      return {
        success: false,
        message: errorMessage,
        tipo: TipoVerbaNormalizer.normalize(tipo),
        wasAlreadyPresent: false
      };
    }
  }, [carregarTipos]);

  /**
   * Executa renomeação de tipo
   * 
   * @param tipoAntigo - Tipo atual
   * @param tipoNovo - Novo tipo
   * @param processId - ID do processo (opcional)
   * @returns Resultado da renomeação
   */
  const renomearTipo = useCallback(async (
    tipoAntigo: string,
    tipoNovo: string,
    processId?: string
  ): Promise<RenameResult> => {
    try {
      setError(null);

      logger.info(
        `Renomeando tipo via hook: "${tipoAntigo}" → "${tipoNovo}"`,
        'useTipoVerbas.renomearTipo',
        { tipoAntigo, tipoNovo, processId }
      );

      // Usa o serviço especializado de renomeação
      const resultado = await RenameService.renomearComAnalise(tipoAntigo, tipoNovo, processId);

      if (resultado.success) {
        // Recarrega tipos após renomear
        await carregarTipos(processId);
      } else {
        setError(resultado.message);
      }

      return resultado;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao renomear tipo';
      setError(errorMessage);

      logger.errorWithException(
        'Erro ao renomear tipo via hook',
        error as Error,
        'useTipoVerbas.renomearTipo',
        { tipoAntigo, tipoNovo, processId }
      );

      throw error;
    }
  }, [carregarTipos]);

  // ===== FUNÇÕES UTILITÁRIAS =====

  /**
   * Valida um tipo usando normalizador especializado
   * 
   * @param tipo - Tipo a ser validado
   * @returns Resultado da validação
   */
  const validarTipo = useCallback((tipo: string) => {
    return TipoVerbaService.validarTipo(tipo);
  }, []);

  /**
   * Obtém estatísticas de um tipo específico
   * 
   * @param tipo - Tipo para estatísticas
   * @returns Estatísticas detalhadas
   */
  const obterEstatisticas = useCallback(async (tipo: string): Promise<TipoStats> => {
    try {
      return await TipoVerbaService.obterEstatisticas(tipo);
    } catch (error) {
      logger.errorWithException(
        'Erro ao obter estatísticas via hook',
        error as Error,
        'useTipoVerbas.obterEstatisticas',
        { tipo }
      );
      throw error;
    }
  }, []);

  /**
   * Força recarregamento invalidando cache
   */
  const forcarRecarregamento = useCallback(async () => {
    TipoVerbaService.limparCache();
    await carregarTipos();
    logger.info('Recarregamento forçado via hook', 'useTipoVerbas.forcarRecarregamento');
  }, [carregarTipos]);

  // ===== INICIALIZAÇÃO =====

  /**
   * Carregamento inicial quando o hook é montado
   * Agora carrega tipos já vinculados ao processId se fornecido
   */
  useEffect(() => {
    const inicializar = async () => {
      try {
        logger.info(
          `Inicializando hook useTipoVerbas${processId ? ` para processo ${processId}` : ' globalmente'}`,
          'useTipoVerbas.inicializar',
          { processId }
        );
        await carregarTipos(processId);
      } catch (error) {
        logger.errorWithException(
          'Erro na inicialização do hook',
          error as Error,
          'useTipoVerbas.inicializar',
          { processId }
        );
      }
    };

    inicializar();
  }, [processId, carregarTipos]); // Recarrega quando processId muda

  // ===== RETORNO DO HOOK =====
  return {
    // Estado atual
    tipos,
    isLoading,
    error,
    
    // Operações principais
    carregarTipos,
    criarTipo,
    renomearTipo,
    
    // Utilitários
    validarTipo,
    obterEstatisticas,
    forcarRecarregamento
  };
};

export default useTipoVerbas;