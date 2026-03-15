import * as XLSX from 'xlsx';
import { Process } from '../types/Process';
import { Decision } from '../types/Decision';
import { Verba } from '../types/Verba';
import { Documento } from '../types/Documento';

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
}

export function exportProcessSpreadsheet(
  process: Process,
  decisions: Decision[],
  verbas: Verba[],
  documentos: Documento[]
): void {
  const wb = XLSX.utils.book_new();

  const processDecisions = decisions.filter(d => d.processId === process.id);
  const processVerbas = verbas.filter(v => v.processId === process.id);
  const processDocumentos = documentos.filter(d => d.processId === process.id);

  const infoRows = [
    ['Numero do Processo', process.numeroProcesso],
    ['Parte Autora', process.reclamante],
    ['Parte Re', process.reclamada],
    ['Status Verbas', process.statusVerbas],
    ['Observacoes', process.observacoesGerais || ''],
    ['Data de Criacao', formatDate(process.dataCriacao)],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Processo');

  const decisoesHeader = ['Tipo de Decisao', 'ID Decisao', 'Situacao', 'Pagina', 'Observacoes', 'Data de Criacao'];
  const decisoesRows = processDecisions.map(d => [
    d.tipoDecisao,
    d.idDecisao,
    d.situacao,
    d.paginaVinculada ?? '',
    d.observacoes ? stripHtmlTags(d.observacoes) : '',
    formatDate(d.dataCriacao),
  ]);
  const wsDecisoes = XLSX.utils.aoa_to_sheet([decisoesHeader, ...decisoesRows]);
  wsDecisoes['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 60 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsDecisoes, 'Decisoes');

  const verbasHeader = [
    'Tipo de Verba',
    'Decisao Vinculada',
    'Situacao',
    'Pagina',
    'Check Calculista',
    'Check Revisor',
    'Fundamentacao',
    'Comentarios',
    'Data de Criacao',
  ];
  const verbasRows: (string | number)[][] = [];
  for (const verba of processVerbas) {
    for (const lanc of verba.lancamentos) {
      verbasRows.push([
        verba.tipoVerba,
        lanc.decisaoVinculada,
        lanc.situacao,
        lanc.paginaVinculada ?? '',
        lanc.checkCalculista ? 'Sim' : 'Nao',
        lanc.checkRevisor ? 'Sim' : 'Nao',
        lanc.fundamentacao ? stripHtmlTags(lanc.fundamentacao) : '',
        lanc.comentariosCalculistas ? stripHtmlTags(lanc.comentariosCalculistas) : '',
        formatDate(lanc.dataCriacao),
      ]);
    }
  }
  const wsVerbas = XLSX.utils.aoa_to_sheet([verbasHeader, ...verbasRows]);
  wsVerbas['!cols'] = [
    { wch: 26 }, { wch: 18 }, { wch: 28 }, { wch: 10 },
    { wch: 18 }, { wch: 14 }, { wch: 50 }, { wch: 50 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsVerbas, 'Verbas e Lancamentos');

  const docsHeader = ['Tipo de Documento', 'Pagina', 'Comentarios', 'Data de Criacao'];
  const docsRows = processDocumentos.map(d => [
    d.tipoDocumento,
    d.paginaVinculada ?? '',
    d.comentarios ? stripHtmlTags(d.comentarios) : '',
    formatDate(d.dataCriacao),
  ]);
  const wsDocs = XLSX.utils.aoa_to_sheet([docsHeader, ...docsRows]);
  wsDocs['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 60 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsDocs, 'Documentos');

  const safeNum = process.numeroProcesso.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, `processo-${safeNum}.xlsx`);
}
