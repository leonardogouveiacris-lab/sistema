/**
 * Utilitários para geração e organização do Relatório de Liquidação
 * Otimizado para melhor performance e menor código duplicado
 */

import { Verba, VerbaLancamento } from '../types/Verba';
import { Decision } from '../types/Decision';
import { DocumentoLancamento } from '../types/DocumentoLancamento';
import {
  calcularResumoSituacoes,
  formatarResumoSituacoes as formatarResumoBase,
  hasMudancaSituacao as hasMudancaBase,
  formatarData as formatarDataBase,
  formatarDataCurta as formatarDataCurtaBase,
  getBadgeColor as getBadgeColorBase,
  stripHtml as stripHtmlBase,
  getPreviewText as getPreviewTextBase
} from './sharedReportUtils';

/**
 * Interface para verba agrupada por tipo com seus lançamentos
 */
export interface VerbaAgrupada {
  tipoVerba: string;
  verbaId: string;
  lancamentos: VerbaLancamento[];
  dataCriacao: Date;
  dataAtualizacao: Date;
  resumoSituacoes: Record<string, number>;
}

/**
 * Interface para estatísticas do relatório
 */
export interface RelatorioEstatisticas {
  totalDecisoes: number;
  totalDocumentos: number;
  totalTiposVerba: number;
  totalLancamentos: number;
  distribuicaoSituacoes: Record<string, number>;
  ultimaAtualizacao: Date | null;
  verbasComMultiplasDecisoes: number;
  verbasComMudancaSituacao: number;
}

/**
 * Agrupa verbas por tipo, mantendo a hierarquia Tipo de Verba > Lançamentos
 * Otimizado para reduzir operações
 */
export function agruparVerbasPorTipo(verbas: Verba[]): VerbaAgrupada[] {
  const agrupadas: VerbaAgrupada[] = new Array(verbas.length);

  for (let i = 0; i < verbas.length; i++) {
    const verba = verbas[i];
    agrupadas[i] = {
      tipoVerba: verba.tipoVerba,
      verbaId: verba.id,
      lancamentos: verba.lancamentos,
      dataCriacao: verba.dataCriacao,
      dataAtualizacao: verba.dataAtualizacao,
      resumoSituacoes: calcularResumoSituacoes(verba.lancamentos)
    };
  }

  return agrupadas.sort((a, b) => a.tipoVerba.localeCompare(b.tipoVerba, 'pt-BR'));
}

// Note: formatarResumoSituacoes is exported directly from sharedReportUtils via utils/index.ts

/**
 * Calcula estatísticas completas do relatório
 * Otimizado para um único loop através dos dados
 */
export function calcularEstatisticasRelatorio(
  verbas: Verba[],
  decisions: Decision[],
  documentos: DocumentoLancamento[]
): RelatorioEstatisticas {
  let totalLancamentos = 0;
  let ultimaAtualizacao = new Date(0);
  let verbasComMultiplasDecisoes = 0;
  let verbasComMudancaSituacao = 0;
  const distribuicaoSituacoes: Record<string, number> = {};

  for (const verba of verbas) {
    const numLancamentos = verba.lancamentos.length;
    totalLancamentos += numLancamentos;

    if (numLancamentos > 1) {
      verbasComMultiplasDecisoes++;
    }

    if (verba.dataAtualizacao > ultimaAtualizacao) {
      ultimaAtualizacao = verba.dataAtualizacao;
    }

    let temMudanca = false;
    let primeiraSituacao: string | undefined;

    for (const lanc of verba.lancamentos) {
      const situacao = lanc.situacao || 'Não especificada';
      distribuicaoSituacoes[situacao] = (distribuicaoSituacoes[situacao] || 0) + 1;

      if (lanc.dataAtualizacao > ultimaAtualizacao) {
        ultimaAtualizacao = lanc.dataAtualizacao;
      }

      if (!temMudanca && numLancamentos > 1) {
        if (primeiraSituacao === undefined) {
          primeiraSituacao = situacao;
        } else if (primeiraSituacao !== situacao) {
          temMudanca = true;
        }
      }
    }

    if (temMudanca) {
      verbasComMudancaSituacao++;
    }
  }

  return {
    totalDecisoes: decisions.length,
    totalDocumentos: documentos.length,
    totalTiposVerba: verbas.length,
    totalLancamentos,
    distribuicaoSituacoes,
    ultimaAtualizacao: ultimaAtualizacao.getTime() > 0 ? ultimaAtualizacao : null,
    verbasComMultiplasDecisoes,
    verbasComMudancaSituacao
  };
}

/**
 * Verifica se uma verba possui múltiplas decisões com situações diferentes
 */
export function verificarMudancaSituacao(verba: VerbaAgrupada): boolean {
  return hasMudancaBase(verba.lancamentos);
}

// Note: getBadgeColor is exported directly from sharedReportUtils via utils/index.ts

/**
 * Ordena verbas agrupadas por critério específico
 * Otimizado para usar sort estável e evitar criação de arrays intermediários
 */
export function ordenarVerbas(
  verbas: VerbaAgrupada[],
  criterio: 'alfabetica' | 'maisRecente' | 'maisLancamentos' = 'alfabetica'
): VerbaAgrupada[] {
  const copia = verbas.slice();

  switch (criterio) {
    case 'maisRecente':
      return copia.sort((a, b) => b.dataAtualizacao.getTime() - a.dataAtualizacao.getTime());
    case 'maisLancamentos':
      return copia.sort((a, b) => b.lancamentos.length - a.lancamentos.length);
    default:
      return copia.sort((a, b) => a.tipoVerba.localeCompare(b.tipoVerba, 'pt-BR'));
  }
}

// Note: stripHtml, getPreviewText, formatarData, formatarDataCurta
// are exported directly from sharedReportUtils via utils/index.ts
