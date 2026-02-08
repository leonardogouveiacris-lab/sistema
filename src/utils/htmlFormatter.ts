/**
 * Formatador de dados para exportação HTML
 * Otimizado para reutilizar funções compartilhadas e melhor performance
 */

import { Process } from '../types/Process';
import { Verba } from '../types/Verba';
import { Decision } from '../types/Decision';
import { DocumentoLancamento } from '../types/DocumentoLancamento';
import HTMLTemplate from './htmlTemplate';
import {
  formatarData,
  calcularResumoSituacoes,
  formatarResumoSituacoes,
  hasMudancaSituacao,
  getBadgeColor as getBadgeColorShared
} from './sharedReportUtils';

/**
 * Classe responsável por formatar dados em HTML
 * Otimizada para reduzir código duplicado
 */
class HTMLFormatter {

  static formatDate = formatarData;

  /**
   * Trunca texto longo para exibição mais limpa
   * Otimizado com slice
   */
  static truncateText(text: string, maxLength: number = 200): string {
    return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
  }
  
  /**
   * Gera HTML do cabeçalho principal do relatório
   *
   * @param selectedProcess - Processo selecionado para o relatório
   * @param ultimaAtualizacao - Data da última atualização (opcional)
   * @returns HTML formatado do cabeçalho
   */
  static generateReportHeader(selectedProcess: Process, ultimaAtualizacao?: Date | null): string {
    return `
      <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-900">
            Relatório de Revisão de Verbas Trabalhistas
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            Relatório detalhado do processo selecionado
          </p>
        </div>

        ${HTMLTemplate.generateProcessInfoHTML(
          selectedProcess.numeroProcesso,
          selectedProcess.reclamante,
          selectedProcess.reclamada,
          this.formatDate(selectedProcess.dataCriacao),
          ultimaAtualizacao ? this.formatDate(ultimaAtualizacao) : undefined
        )}
      </div>
    `;
  }
  
  /**
   * Gera HTML de um lançamento individual com visual indentado
   *
   * @param lancamento - Dados do lançamento
   * @param index - Índice do lançamento na lista
   * @returns HTML formatado do lançamento
   */
  static generateLancamentoHTML(lancamento: any, index: number): string {
    return `
      <div class="lancamento-item border-l-4 border-l-gray-300 pl-4 py-3 bg-white rounded-r-lg">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-medium text-gray-500">#${index}</span>
            ${lancamento.paginaVinculada ? `
              <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium text-cyan-700 bg-cyan-100 rounded">
                p.${lancamento.paginaVinculada}
              </span>
            ` : ''}
          </div>
          ${HTMLTemplate.generateSituacaoBadge(lancamento.situacao)}
        </div>

        <div class="space-y-2">
          <div class="text-sm">
            <span class="font-medium text-gray-700">Decisão:</span>
            <span class="ml-2 text-gray-900">${lancamento.decisaoVinculada}</span>
          </div>

          ${lancamento.fundamentacao ? `
            <div class="text-sm">
              <span class="font-medium text-gray-700">Fundamentação:</span>
              <div class="mt-1 text-gray-600 formatted-content leading-relaxed">
                ${lancamento.fundamentacao}
              </div>
            </div>
          ` : ''}

          ${lancamento.comentariosCalculistas ? `
            <div class="text-sm">
              <span class="font-medium text-gray-700">Comentários:</span>
              <div class="mt-1 text-gray-600 formatted-content leading-relaxed">
                ${lancamento.comentariosCalculistas}
              </div>
            </div>
          ` : ''}

          <div class="text-xs text-gray-500 pt-2 border-t border-gray-100">
            Cadastrado em: ${this.formatDate(lancamento.dataCriacao)}
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Gera resumo de situações para exibição
   * Otimizado com função compartilhada
   */
  static generateResumoSituacoes(lancamentos: any[]): string {
    const resumo = calcularResumoSituacoes(lancamentos);
    return formatarResumoSituacoes(resumo);
  }

  /**
   * Verifica se uma verba tem mudança de situação entre lançamentos
   * Otimizado com função compartilhada
   */
  static hasMudancaSituacao(lancamentos: any[]): boolean {
    return hasMudancaSituacao(lancamentos);
  }

  /**
   * Gera HTML de uma verba completa com hierarquia visual (expansível)
   * Otimizado com array.join()
   */
  static generateVerbaHTML(verba: Verba, index: number): string {
    const temMudancaSituacao = this.hasMudancaSituacao(verba.lancamentos);
    const resumoSituacoes = this.generateResumoSituacoes(verba.lancamentos);
    const numLanc = verba.lancamentos.length;
    const plural = numLanc !== 1 ? 's' : '';

    const lancamentosHTML = verba.lancamentos
      .map((lancamento, lancIndex) => this.generateLancamentoHTML(lancamento, lancIndex + 1))
      .join('');

    const parts = [
      '<div class="verba-container border border-gray-200 rounded-lg bg-white shadow-sm mb-6">',
      '<div class="verba-header px-5 py-4 bg-gray-50 rounded-t-lg">',
      '<div class="flex items-start justify-between">',
      '<div class="flex-1">',
      '<div class="flex items-center space-x-3 mb-2">',
      `<span class="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">${index + 1}</span>`,
      `<h4 class="text-lg font-semibold text-gray-900">${verba.tipoVerba}</h4>`
    ];

    if (temMudancaSituacao) {
      parts.push(
        '<span class="flex items-center space-x-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full border border-yellow-200">',
        '<span>⚠</span><span>Mudança de situação</span></span>'
      );
    }

    parts.push(
      '</div>',
      '<div class="flex items-center space-x-4 text-sm text-gray-600">',
      `<span><strong>${numLanc}</strong> lançamento${plural}</span>`,
      '<span>•</span>',
      `<span>${resumoSituacoes}</span>`,
      '</div></div></div></div>',
      '<div class="lancamentos-list px-5 py-4 space-y-3 bg-gray-50">',
      lancamentosHTML,
      '</div></div>'
    );

    return parts.join('');
  }
  
  /**
   * Gera HTML do relatório completo das verbas com hierarquia
   *
   * @param verbas - Array de verbas do processo
   * @returns HTML formatado do relatório detalhado
   */
  static generateReportContent(verbas: Verba[]): string {
    // Calcula total de lançamentos
    const totalLancamentos = verbas.reduce((total, verba) => total + verba.lancamentos.length, 0);

    if (verbas.length === 0) {
      return `
        <div class="bg-white rounded-lg border border-gray-200 p-8">
          <div class="text-center py-12">
            <div class="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span class="text-gray-400 text-lg">⚖</span>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              Nenhuma verba encontrada
            </h3>
            <p class="text-gray-500 text-sm">
              Este processo não possui verbas trabalhistas cadastradas ainda.
            </p>
          </div>
        </div>
      `;
    }

    // Ordena verbas alfabeticamente por tipo
    const verbasOrdenadas = [...verbas].sort((a, b) =>
      a.tipoVerba.localeCompare(b.tipoVerba, 'pt-BR')
    );

    // Gera HTML para cada verba
    const verbasHTML = verbasOrdenadas
      .map((verba, index) => this.generateVerbaHTML(verba, index + 1))
      .join('');

    return `
      <div id="verbas" class="bg-white rounded-lg border border-gray-200 mt-8">
        <div class="section-header px-6 py-4 border-b border-gray-200">
          <div class="flex items-center space-x-3">
            <div class="section-icon" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background-color: #f3f4f6; border-radius: 8px; flex-shrink: 0;">
              <span style="font-size: 16px; color: #6b7280; font-weight: 600;">V</span>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">
                Verbas Trabalhistas
              </h3>
              <p class="text-sm text-gray-500 mt-0.5">
                ${verbas.length} tipo${verbas.length !== 1 ? 's' : ''} de verba, ${totalLancamentos} lancamento${totalLancamentos !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50">
          ${verbasHTML}
        </div>
      </div>
    `;
  }
  
  /**
   * Gera título personalizado para o arquivo HTML
   *
   * @param numeroProcesso - Número do processo
   * @returns Título formatado para o documento
   */
  static generateReportTitle(numeroProcesso: string): string {
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    return `Relatório de Verbas - Processo ${numeroProcesso} - ${date}`;
  }

  /**
   * Gera índice de navegação rápida para o relatório HTML
   *
   * @param totalDecisoes - Total de decisões no processo
   * @param totalDocumentos - Total de documentos no processo
   * @param totalVerbas - Total de tipos de verba no processo
   * @returns HTML formatado do índice de navegação
   */
  static generateNavigationIndex(totalDecisoes: number, totalDocumentos: number, totalVerbas: number): string {
    const sections = [
      { id: 'decisoes', label: 'Decisoes Judiciais', count: totalDecisoes, letter: 'J' },
      { id: 'documentos', label: 'Lancamentos de Documentos', count: totalDocumentos, letter: 'D' },
      { id: 'verbas', label: 'Verbas Trabalhistas', count: totalVerbas, letter: 'V' }
    ].filter(section => section.count > 0);

    if (sections.length === 0) return '';

    const sectionsHTML = sections.map(section => {
      return `
        <a href="#${section.id}" class="flex items-center space-x-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm no-print" style="text-decoration: none; color: inherit;">
          <span style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; background-color: #e5e7eb; border-radius: 4px; font-size: 11px; font-weight: 600; color: #6b7280;">${section.letter}</span>
          <span style="color: #374151;">${section.label}</span>
          <span style="font-size: 0.75rem; background-color: #e5e7eb; color: #374151; padding: 0.125rem 0.5rem; border-radius: 9999px; font-weight: 500;">
            ${section.count}
          </span>
        </a>
      `;
    }).join('');

    return `
      <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6 no-print">
        <h3 class="text-sm font-medium text-gray-700 mb-3">Navegação Rápida</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${sectionsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Gera HTML de um lançamento de documento individual com design refinado
   *
   * @param documento - Dados do documento
   * @param index - Índice do documento na lista
   * @returns HTML formatado do documento
   */
  static generateDocumentoLancamentoHTML(documento: DocumentoLancamento, index: number): string {
    return `
      <div class="documento-card border border-gray-200 rounded-lg p-4 bg-white mb-2">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center justify-center w-6 h-6 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
              ${index}
            </span>
            <span class="text-sm font-semibold text-gray-900">
              ${documento.tipoDocumento}
            </span>
            ${documento.paginaVinculada ? `
              <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium text-cyan-700 bg-cyan-100 rounded">
                p.${documento.paginaVinculada}
              </span>
            ` : ''}
          </div>
        </div>

        ${documento.comentarios ? `
          <div class="text-sm text-gray-700 leading-relaxed mb-3">
            <span class="font-medium">Comentários:</span>
            <div class="mt-1 formatted-content">${documento.comentarios}</div>
          </div>
        ` : ''}

        <div class="text-xs text-gray-500 pt-2 border-t border-gray-100">
          Cadastrado em: ${this.formatDate(documento.dataCriacao)}
        </div>
      </div>
    `;
  }

  /**
   * Gera seção HTML completa dos lançamentos de documentos com design refinado
   *
   * @param documentos - Array de lançamentos de documentos
   * @returns HTML formatado da seção de documentos
   */
  static generateDocumentosSection(documentos: DocumentoLancamento[]): string {
    if (documentos.length === 0) {
      return '';
    }

    const documentosHTML = documentos
      .map((doc, index) => this.generateDocumentoLancamentoHTML(doc, index + 1))
      .join('');

    return `
      <div id="documentos" class="bg-white rounded-lg border border-gray-200 mt-8">
        <div class="section-header px-6 py-4 border-b border-gray-200">
          <div class="flex items-center space-x-3">
            <div class="section-icon" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background-color: #f3f4f6; border-radius: 8px; flex-shrink: 0;">
              <span style="font-size: 16px; color: #6b7280; font-weight: 600;">D</span>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">
                Lancamentos de Documentos
              </h3>
              <p class="text-sm text-gray-500 mt-0.5">
                ${documentos.length} documento${documentos.length !== 1 ? 's' : ''} vinculado${documentos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50">
          ${documentosHTML}
        </div>
      </div>
    `;
  }

  /**
   * Gera cor do badge baseado na situação da decisão
   * Otimizado com função compartilhada
   */
  static getDecisionSituacaoBadgeColor(situacao: string): string {
    return getBadgeColorShared(situacao);
  }

  /**
   * Gera HTML de uma decisão individual com design refinado
   *
   * @param decision - Dados da decisão
   * @param index - Índice da decisão na lista
   * @returns HTML formatado da decisão
   */
  static generateDecisionHTML(decision: Decision, index: number): string {
    return `
      <div class="decision-card border border-gray-200 rounded-lg p-4 bg-white mb-2">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              ${index}
            </span>
            <span class="text-sm font-semibold text-gray-900">
              ${decision.tipoDecisao}
            </span>
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded">
              ${decision.idDecisao}
            </span>
            ${decision.paginaVinculada ? `
              <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium text-cyan-700 bg-cyan-100 rounded">
                p.${decision.paginaVinculada}
              </span>
            ` : ''}
          </div>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${this.getDecisionSituacaoBadgeColor(decision.situacao)}">
            ${decision.situacao}
          </span>
        </div>

        ${decision.observacoes ? `
          <div class="text-sm text-gray-700 leading-relaxed mb-3">
            <span class="font-medium">Observações:</span>
            <div class="mt-1 formatted-content">${decision.observacoes}</div>
          </div>
        ` : ''}

        <div class="text-xs text-gray-500 pt-2 border-t border-gray-100">
          Cadastrado em: ${this.formatDate(decision.dataCriacao)}
        </div>
      </div>
    `;
  }

  /**
   * Gera seção HTML completa das decisões com design refinado
   *
   * @param decisions - Array de decisões
   * @returns HTML formatado da seção de decisões
   */
  static generateDecisionsSection(decisions: Decision[]): string {
    if (decisions.length === 0) {
      return '';
    }

    const decisionsHTML = decisions
      .map((decision, index) => this.generateDecisionHTML(decision, index + 1))
      .join('');

    return `
      <div id="decisoes" class="bg-white rounded-lg border border-gray-200 mt-8">
        <div class="section-header px-6 py-4 border-b border-gray-200">
          <div class="flex items-center space-x-3">
            <div class="section-icon" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background-color: #f3f4f6; border-radius: 8px; flex-shrink: 0;">
              <span style="font-size: 16px; color: #6b7280; font-weight: 600;">J</span>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">
                Decisoes Judiciais
              </h3>
              <p class="text-sm text-gray-500 mt-0.5">
                ${decisions.length} decisao${decisions.length !== 1 ? 'es' : ''} vinculada${decisions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50">
          ${decisionsHTML}
        </div>
      </div>
    `;
  }
}

export default HTMLFormatter;