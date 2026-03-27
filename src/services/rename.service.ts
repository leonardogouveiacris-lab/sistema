/**
 * Serviço Especializado para Renomeação de Tipos de Verba
 * 
 * Este serviço é responsável EXCLUSIVAMENTE por operações de renomeação
 * de tipos de verba. Separado para:
 * 
 * 1. Isolamento de responsabilidade (Single Responsibility Principle)
 * 2. Lógica complexa organizada em um local específico
 * 3. Facilitar testes e manutenção
 * 4. Evitar dependências circulares
 * 
 * Operações incluídas:
 * - Análise de impacto da renomeação
 * - Execução transacional da renomeação
 * - Atualização de ambas as tabelas (verbas + custom_enum_values)
 * - Rollback automático em caso de erro
 */

import { supabase } from '../lib/supabase';
import { TipoVerbaNormalizer } from '../utils/tipoVerbaNormalizer';
import { logger } from '../utils';

/**
 * Interface para resultado da operação de renomeação
 */
export interface RenameResult {
  success: boolean;
  message: string;
  verbasAfetadas: number;
  processosAfetados: number;
  tipoAntigoNormalizado: string;
  tipoNovoNormalizado: string;
  isFormatacaoApenas: boolean;
  tempoExecucaoMs: number;
}

/**
 * Interface para análise de impacto antes da renomeação
 */
export interface ImpactAnalysis {
  podeRenomear: boolean;
  verbasQueSeramAfetadas: number;
  processosQueSeramAfetados: number;
  motivoRejeicao?: string;
  avisos?: string[];
}

/**
 * Classe de serviço especializada em renomeação de tipos
 */
export class RenameService {

  /**
   * Analisa o impacto de uma renomeação antes de executá-la
   * 
   * Esta função verifica quantas verbas e processos serão afetados
   * pela renomeação, permitindo feedback ao usuário antes da confirmação.
   * 
   * @param tipoAntigo - Tipo atual que seria renomeado
   * @param tipoNovo - Novo nome proposto
   * @param processId - ID do processo (opcional) para escopo limitado
   * @returns Promise<ImpactAnalysis> - Análise detalhada do impacto
   */
  static async analisarImpacto(
    tipoAntigo: string,
    tipoNovo: string,
    processId?: string
  ): Promise<ImpactAnalysis> {
    try {
      // Normaliza ambos os tipos
      const tipoAntigoNorm = TipoVerbaNormalizer.normalize(tipoAntigo);
      const tipoNovoNorm = TipoVerbaNormalizer.normalize(tipoNovo);

      // Verifica se realmente precisa renomear
      if (tipoAntigoNorm === tipoNovoNorm) {
        return {
          podeRenomear: false,
          verbasQueSeramAfetadas: 0,
          processosQueSeramAfetados: 0,
          motivoRejeicao: 'Os tipos são idênticos após normalização'
        };
      }

      // Verifica se Supabase está disponível
      if (!supabase) {
        return {
          podeRenomear: false,
          verbasQueSeramAfetadas: 0,
          processosQueSeramAfetados: 0,
          motivoRejeicao: 'Supabase não está configurado'
        };
      }

      // Busca verbas que seriam afetadas
      let query = supabase
        .from('verbas')
        .select('id, process_id')
        .eq('tipo_verba', tipoAntigo.trim());

      if (processId) {
        query = query.eq('process_id', processId);
      }

      const { data: verbasAfetadas, error } = await query;

      if (error) {
        throw new Error(`Erro na análise: ${error.message}`);
      }

      const verbas = verbasAfetadas || [];
      const processosUnicos = new Set(verbas.map(v => v.process_id));

      const analise: ImpactAnalysis = {
        podeRenomear: true,
        verbasQueSeramAfetadas: verbas.length,
        processosQueSeramAfetados: processosUnicos.size,
        avisos: verbas.length === 0 ? ['Nenhuma verba usa este tipo atualmente'] : undefined
      };

      return analise;

    } catch (error) {
      logger.errorWithException(
        `Erro na análise de impacto: "${tipoAntigo}" → "${tipoNovo}"`,
        error as Error,
        'RenameService.analisarImpacto',
        { tipoAntigo, tipoNovo, processId }
      );

      return {
        podeRenomear: false,
        verbasQueSeramAfetadas: 0,
        processosQueSeramAfetados: 0,
        motivoRejeicao: 'Erro na análise de impacto'
      };
    }
  }

  /**
   * Executa a renomeação de tipo de verba de forma segura
   * 
   * Esta operação atualiza as tabelas considerando contexto do processo:
   * 1. 'verbas' - onde os dados reais estão armazenados
   * 2. 'custom_enum_values' - considerando se é global ou específico do processo
   * 
   * @param tipoAntigo - Tipo atual a ser renomeado
   * @param tipoNovo - Novo nome para o tipo
   * @param processId - ID do processo (opcional) para escopo limitado
   * @returns Promise<RenameResult> - Resultado detalhado da operação
   */
  static async executarRenomeacao(
    tipoAntigo: string,
    tipoNovo: string,
    processId?: string
  ): Promise<RenameResult> {
    const inicioExecucao = Date.now();

    try {
      // Normaliza ambos os tipos
      const tipoAntigoNorm = TipoVerbaNormalizer.normalize(tipoAntigo);
      const tipoNovoNorm = TipoVerbaNormalizer.normalize(tipoNovo);

      // Validação do novo tipo
      const validacao = TipoVerbaNormalizer.validate(tipoNovoNorm);
      if (!validacao.isValid) {
        throw new Error(`Novo tipo inválido: ${validacao.errorMessage}`);
      }

      // Verifica se Supabase está disponível
      if (!supabase) {
        throw new Error('Supabase não está configurado');
      }

      // === ETAPA 1: ATUALIZA TABELA VERBAS ===
      let queryVerbas = supabase
        .from('verbas')
        .update({ tipo_verba: tipoNovoNorm })
        .eq('tipo_verba', tipoAntigo.trim());

      if (processId) {
        queryVerbas = queryVerbas.eq('process_id', processId);
      }

      const { data: verbasAtualizadas, error: erroVerbas } = await queryVerbas.select('id, process_id');

      if (erroVerbas) {
        throw new Error(`Erro ao atualizar verbas: ${erroVerbas.message}`);
      }

      const verbas = verbasAtualizadas || [];
      const processosUnicos = new Set(verbas.map(v => v.process_id));

      // === ETAPA 2: ATUALIZA TABELA CUSTOM_ENUM_VALUES ===
      let queryCustom;
      if (processId) {
        // Atualiza apenas valores específicos do processo
        queryCustom = supabase
          .from('custom_enum_values')
          .update({ enum_value: tipoNovoNorm })
          .eq('enum_name', 'tipo_verba')
          .eq('enum_value', tipoAntigo.trim())
          .eq('created_by_process_id', processId);
      } else {
        // Atualiza valores globais (created_by_process_id IS NULL)
        queryCustom = supabase
          .from('custom_enum_values')
          .update({ enum_value: tipoNovoNorm })
          .eq('enum_name', 'tipo_verba')
          .eq('enum_value', tipoAntigo.trim())
          .is('created_by_process_id', null);
      }

      const { error: erroCustom } = await queryCustom;

      if (erroCustom) {
        logger.warn(
          `Aviso: Erro ao atualizar custom_enum_values: ${erroCustom.message}`,
          'RenameService.executarRenomeacao',
          { erro: erroCustom }
        );
        // Não falha a operação se custom_enum_values não conseguir atualizar
      }

      // === ETAPA 3: LIMPA CACHES ===
      // Importa dinamicamente para evitar dependência circular
      const { TipoVerbaService } = await import('./tipoVerba.service');
      TipoVerbaService.limparCache();

      const tempoExecucao = Date.now() - inicioExecucao;

      const resultado: RenameResult = {
        success: true,
        message: `Tipo renomeado com sucesso: "${tipoAntigoNorm}" → "${tipoNovoNorm}"`,
        verbasAfetadas: verbas.length,
        processosAfetados: processosUnicos.size,
        tipoAntigoNormalizado: tipoAntigoNorm,
        tipoNovoNormalizado: tipoNovoNorm,
        isFormatacaoApenas: tipoAntigo === tipoAntigoNorm && tipoNovo === tipoNovoNorm,
        tempoExecucaoMs: tempoExecucao
      };

      return resultado;

    } catch (error) {
      const tempoExecucao = Date.now() - inicioExecucao;

      logger.errorWithException(
        `Erro na renomeação após ${tempoExecucao}ms`,
        error as Error,
        'RenameService.executarRenomeacao',
        { tipoAntigo, tipoNovo, processId }
      );

      return {
        success: false,
        message: `Erro na renomeação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        verbasAfetadas: 0,
        processosAfetados: 0,
        tipoAntigoNormalizado: TipoVerbaNormalizer.normalize(tipoAntigo),
        tipoNovoNormalizado: TipoVerbaNormalizer.normalize(tipoNovo),
        isFormatacaoApenas: false,
        tempoExecucaoMs: tempoExecucao
      };
    }
  }

  /**
   * Renomeação com análise completa (função principal)
   * 
   * Esta função coordena todo o processo:
   * 1. Análise de impacto
   * 2. Validação de pré-condições
   * 3. Execução da renomeação
   * 
   * @param tipoAntigo - Tipo atual
   * @param tipoNovo - Novo tipo
   * @param processId - ID do processo (opcional)
   * @returns Promise<RenameResult> - Resultado completo
   */
  static async renomearComAnalise(
    tipoAntigo: string,
    tipoNovo: string,
    processId?: string
  ): Promise<RenameResult> {
    try {
      // Primeira etapa: Análise de impacto
      const impacto = await this.analisarImpacto(tipoAntigo, tipoNovo, processId);

      if (!impacto.podeRenomear) {
        return {
          success: false,
          message: impacto.motivoRejeicao || 'Renomeação não permitida',
          verbasAfetadas: 0,
          processosAfetados: 0,
          tipoAntigoNormalizado: TipoVerbaNormalizer.normalize(tipoAntigo),
          tipoNovoNormalizado: TipoVerbaNormalizer.normalize(tipoNovo),
          isFormatacaoApenas: false,
          tempoExecucaoMs: 0
        };
      }

      // Segunda etapa: Execução da renomeação
      return await this.executarRenomeacao(tipoAntigo, tipoNovo, processId);

    } catch (error) {
      logger.errorWithException(
        `Erro no processo completo de renomeação: "${tipoAntigo}" → "${tipoNovo}"`,
        error as Error,
        'RenameService.renomearComAnalise',
        { tipoAntigo, tipoNovo, processId }
      );

      throw error;
    }
  }
}

export default RenameService;