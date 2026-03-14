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
  excluirTipo: (tipo: string, processId?: string) => Promise<{ success: boolean; message: string; totalLancamentos?: number }>;

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

      const tiposCarregados = await TipoVerbaService.getTiposDistintos(processId);
      setTipos(tiposCarregados);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar tipos';
      setError(errorMessage);
      logger.error(errorMessage, 'useTipoVerbas.carregarTipos');
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

      const resultado = await TipoVerbaService.criarTipo(tipo, processId);

      if (resultado.success) {
        await carregarTipos(processId);
      }

      return resultado;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar tipo';
      setError(errorMessage);
      logger.error(errorMessage, 'useTipoVerbas.criarTipo');

      return {
        success: false,
        message: errorMessage,
        tipo: TipoVerbaNormalizer.normalize(tipo),
        wasAlreadyPresent: false
      };
    }
  }, [carregarTipos]);

  const excluirTipo = useCallback(async (
    tipo: string,
    processId?: string
  ): Promise<{ success: boolean; message: string; totalLancamentos?: number }> => {
    try {
      setError(null);
      const resultado = await TipoVerbaService.removerTipo(tipo, processId);
      if (resultado.success) {
        await carregarTipos(processId);
      } else {
        setError(resultado.message);
      }
      return resultado;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir tipo';
      setError(errorMessage);
      logger.error(errorMessage, 'useTipoVerbas.excluirTipo');
      return { success: false, message: errorMessage };
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

      const resultado = await RenameService.renomearComAnalise(tipoAntigo, tipoNovo, processId);

      if (resultado.success) {
        await carregarTipos(processId);
      } else {
        setError(resultado.message);
      }

      return resultado;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao renomear tipo';
      setError(errorMessage);
      logger.error(errorMessage, 'useTipoVerbas.renomearTipo');
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
    return await TipoVerbaService.obterEstatisticas(tipo);
  }, []);

  /**
   * Força recarregamento invalidando cache
   */
  const forcarRecarregamento = useCallback(async () => {
    TipoVerbaService.limparCache();
    await carregarTipos();
  }, [carregarTipos]);

  // ===== INICIALIZAÇÃO =====

  /**
   * Carregamento inicial quando o hook é montado
   * Agora carrega tipos já vinculados ao processId se fornecido
   */
  useEffect(() => {
    carregarTipos(processId);
  }, [processId, carregarTipos]);

  // ===== RETORNO DO HOOK =====
  return {
    tipos,
    isLoading,
    error,
    carregarTipos,
    criarTipo,
    renomearTipo,
    excluirTipo,
    validarTipo,
    obterEstatisticas,
    forcarRecarregamento
  };
};

export default useTipoVerbas;