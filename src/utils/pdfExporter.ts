/**
 * Utilitário para exportação de relatórios diretamente em PDF
 *
 * Este arquivo contém a lógica para gerar e exportar relatórios
 * em formato PDF usando html2pdf.js, que renderiza HTML em canvas
 * e converte para PDF no navegador.
 *
 * Limitações conhecidas:
 * - Texto renderizado como imagem (não selecionável/pesquisável)
 * - Arquivos maiores que PDFs nativos
 * - Melhor para documentos de até 10-15 páginas
 */

import html2pdf from 'html2pdf.js';
import { Process } from '../types/Process';
import { Verba } from '../types/Verba';
import { Decision } from '../types/Decision';
import { DocumentoLancamento } from '../types/DocumentoLancamento';
import HTMLFormatter from './htmlFormatter';
import HTMLTemplate from './htmlTemplate';
import logger from './logger';

interface PDFExportOptions {
  includeTimestamp?: boolean;
  customFileName?: string;
  quality?: 'low' | 'medium' | 'high';
  pageOrientation?: 'portrait' | 'landscape';
}

interface Html2PdfOptions {
  margin: number | number[];
  filename: string;
  image: { type: string; quality: number };
  html2canvas: {
    scale: number;
    useCORS: boolean;
    letterRendering: boolean;
    logging: boolean;
    windowWidth?: number;
    width?: number;
  };
  jsPDF: {
    unit: string;
    format: string;
    orientation: 'portrait' | 'landscape';
  };
  pagebreak: { mode: string | string[] };
}

class PDFExporter {

  private static getQualitySettings(quality: 'low' | 'medium' | 'high'): { scale: number; imageQuality: number } {
    switch (quality) {
      case 'low':
        return { scale: 1, imageQuality: 0.7 };
      case 'high':
        return { scale: 3, imageQuality: 0.98 };
      case 'medium':
      default:
        return { scale: 2, imageQuality: 0.92 };
    }
  }

  static async exportRelatorioPDF(
    selectedProcess: Process,
    verbas: Verba[],
    decisions: Decision[],
    documentoLancamentos: DocumentoLancamento[] = [],
    options: PDFExportOptions = {}
  ): Promise<boolean> {
    try {
      logger.info(
        `Iniciando exportação PDF para processo: ${selectedProcess.numeroProcesso}`,
        'PDFExporter - exportRelatorioPDF',
        {
          processId: selectedProcess.id,
          totalVerbas: verbas.length,
          totalLancamentos: verbas.reduce((acc, v) => acc + v.lancamentos.length, 0)
        }
      );

      const verbasDoProcesso = verbas.filter(verba => verba.processId === selectedProcess.id);
      const ultimaAtualizacao = this.calculateLastUpdate(verbasDoProcesso);
      const decisionsDoProcesso = decisions.filter(
        decision => decision.processId === selectedProcess.id
      );
      const documentosDoProcesso = documentoLancamentos.filter(
        doc => doc.processId === selectedProcess.id
      );

      const htmlContent = this.generateReportHTMLForPDF(
        selectedProcess,
        verbasDoProcesso,
        decisionsDoProcesso,
        documentosDoProcesso,
        ultimaAtualizacao
      );

      const fileName = this.generateFileName(selectedProcess.numeroProcesso, options);

      const quality = options.quality || 'medium';
      const qualitySettings = this.getQualitySettings(quality);

      const html2pdfOptions: Html2PdfOptions = {
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: qualitySettings.imageQuality },
        html2canvas: {
          scale: qualitySettings.scale,
          useCORS: true,
          letterRendering: true,
          logging: false,
          windowWidth: 794,
          width: 794
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: options.pageOrientation || 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      logger.info(
        `Conteúdo HTML gerado com ${htmlContent.length} caracteres`,
        'PDFExporter - exportRelatorioPDF',
        { contentLength: htmlContent.length }
      );

      const element = document.createElement('div');
      element.innerHTML = htmlContent;

      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '210mm';
      element.style.minHeight = '297mm';
      element.style.padding = '20px';
      element.style.background = 'white';
      element.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      element.style.fontSize = '14px';
      element.style.lineHeight = '1.5';
      element.style.boxSizing = 'border-box';
      element.style.overflow = 'visible';
      element.style.zIndex = '-9999';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';

      document.body.appendChild(element);

      logger.info(
        `Elemento adicionado ao DOM com ${element.innerHTML.length} caracteres`,
        'PDFExporter - exportRelatorioPDF',
        {
          elementContentLength: element.innerHTML.length,
          elementWidth: element.offsetWidth,
          elementHeight: element.offsetHeight
        }
      );

      await new Promise(resolve => setTimeout(resolve, 200));

      try {
        await html2pdf().set(html2pdfOptions).from(element).save();

        await new Promise(resolve => setTimeout(resolve, 100));

        logger.success(
          `Relatório PDF exportado com sucesso: ${fileName}`,
          'PDFExporter - exportRelatorioPDF',
          {
            processNumber: selectedProcess.numeroProcesso,
            verbasCount: verbasDoProcesso.length,
            quality
          }
        );

        return true;
      } finally {
        if (document.body.contains(element)) {
          document.body.removeChild(element);
        }
      }

    } catch (error) {
      logger.errorWithException(
        'Falha na exportação do relatório PDF',
        error as Error,
        'PDFExporter - exportRelatorioPDF',
        {
          processNumber: selectedProcess.numeroProcesso,
          options
        }
      );

      return false;
    }
  }

  private static calculateLastUpdate(verbas: Verba[]): Date | null {
    if (verbas.length === 0) return null;

    let ultimaAtualizacao = new Date(0);

    for (const verba of verbas) {
      if (verba.dataAtualizacao > ultimaAtualizacao) {
        ultimaAtualizacao = verba.dataAtualizacao;
      }

      for (const lancamento of verba.lancamentos) {
        if (lancamento.dataAtualizacao > ultimaAtualizacao) {
          ultimaAtualizacao = lancamento.dataAtualizacao;
        }
      }
    }

    return ultimaAtualizacao;
  }

  private static generateReportHTMLForPDF(
    process: Process,
    verbas: Verba[],
    decisions: Decision[],
    documentoLancamentos: DocumentoLancamento[],
    ultimaAtualizacao: Date | null
  ): string {
    const headerHTML = HTMLFormatter.generateReportHeader(process, ultimaAtualizacao || undefined);
    const tiposVerbaUnicos = new Set(verbas.map(v => v.tipoVerba)).size;
    const navigationIndex = HTMLFormatter.generateNavigationIndex(
      decisions.length,
      documentoLancamentos.length,
      tiposVerbaUnicos
    );
    const decisionsHTML = HTMLFormatter.generateDecisionsSection(decisions);
    const documentosHTML = HTMLFormatter.generateDocumentosSection(documentoLancamentos);
    const contentHTML = HTMLFormatter.generateReportContent(verbas);

    const reportContent = headerHTML + navigationIndex + decisionsHTML + documentosHTML + contentHTML;

    return HTMLTemplate.generateContentForPDF(
      reportContent,
      {
        includeHeaderFooter: false
      }
    );
  }

  private static generateFileName(numeroProcesso: string, options: PDFExportOptions): string {
    if (options.customFileName) {
      return options.customFileName.endsWith('.pdf')
        ? options.customFileName
        : options.customFileName + '.pdf';
    }

    const parts = ['relatorio-verbas-', numeroProcesso.replace(/[^a-zA-Z0-9]/g, '-')];

    if (options.includeTimestamp !== false) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      parts.push('-', timestamp);
    }

    parts.push('.pdf');
    return parts.join('');
  }
}

export default PDFExporter;
