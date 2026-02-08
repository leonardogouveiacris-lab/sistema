import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  FileText,
  Gavel,
  Scale
} from 'lucide-react';
import { Process } from '../types/Process';
import { Verba, VerbaLancamento } from '../types/Verba';
import { Decision } from '../types/Decision';
import { Documento } from '../types/Documento';
import { EmptyState } from './ui';
import { useToast } from '../contexts/ToastContext';
import logger from '../utils/logger';
import { useBackToTop } from '../hooks/useBackToTop';
import {
  agruparVerbasPorTipo,
  calcularEstatisticasRelatorio,
  formatarResumoSituacoes,
  verificarMudancaSituacao,
  formatarData,
  formatarDataCurta,
  filtrarPorProcesso,
  VerbaAgrupada
} from '../utils';

const ITEMS_PER_SECTION = 10;

const getSituacaoStyle = (situacao: string): string => {
  const situacaoLower = situacao.toLowerCase();
  if (situacaoLower.includes('deferida') || situacaoLower.includes('procedente') || situacaoLower.includes('homologad')) {
    return 'text-green-700';
  }
  if (situacaoLower.includes('indeferida') || situacaoLower.includes('excluida') || situacaoLower.includes('improcedente') || situacaoLower.includes('rejeitad')) {
    return 'text-red-700';
  }
  if (situacaoLower.includes('parcial')) {
    return 'text-amber-700';
  }
  return 'text-gray-700';
};

interface RelatorioVerbasProps {
  selectedProcess: Process | null;
  verbas: Verba[];
  decisions: Decision[];
  documentos?: Documento[];
  onBackToProcessList: () => void;
}

const RelatorioVerbas: React.FC<RelatorioVerbasProps> = ({
  selectedProcess,
  verbas,
  decisions,
  documentos = [],
  onBackToProcessList
}) => {
  const toast = useToast();
  const [expandedVerbas, setExpandedVerbas] = useState<Record<string, boolean>>({});
  const { showBackToTop, observerTargetRef } = useBackToTop();
  const previousExpandedStateRef = useRef<Record<string, boolean>>({});

  const [visibleDecisionsCount, setVisibleDecisionsCount] = useState(ITEMS_PER_SECTION);
  const [visibleDocumentosCount, setVisibleDocumentosCount] = useState(ITEMS_PER_SECTION);
  const [visibleVerbasCount, setVisibleVerbasCount] = useState(ITEMS_PER_SECTION);

  const processId = selectedProcess?.id;

  const verbasDoProcesso = useMemo(() => {
    if (!processId) return [];
    return filtrarPorProcesso(verbas, processId);
  }, [verbas, processId]);

  const verbasAgrupadas = useMemo(() => {
    return agruparVerbasPorTipo(verbasDoProcesso);
  }, [verbasDoProcesso]);

  const decisionsDoProcesso = useMemo(() => {
    if (!processId) return [];
    return filtrarPorProcesso(decisions, processId);
  }, [decisions, processId]);

  const documentosDoProcesso = useMemo(() => {
    if (!processId) return [];
    return filtrarPorProcesso(documentos, processId);
  }, [documentos, processId]);

  const visibleDecisions = useMemo(() => {
    return decisionsDoProcesso.slice(0, visibleDecisionsCount);
  }, [decisionsDoProcesso, visibleDecisionsCount]);

  const visibleDocumentos = useMemo(() => {
    return documentosDoProcesso.slice(0, visibleDocumentosCount);
  }, [documentosDoProcesso, visibleDocumentosCount]);

  const visibleVerbas = useMemo(() => {
    return verbasAgrupadas.slice(0, visibleVerbasCount);
  }, [verbasAgrupadas, visibleVerbasCount]);

  const hasMoreDecisions = decisionsDoProcesso.length > visibleDecisionsCount;
  const hasMoreDocumentos = documentosDoProcesso.length > visibleDocumentosCount;
  const hasMoreVerbas = verbasAgrupadas.length > visibleVerbasCount;

  const estatisticas = useMemo(() => {
    if (!selectedProcess) {
      return {
        totalDecisoes: 0,
        totalDocumentos: 0,
        totalTiposVerba: 0,
        totalLancamentos: 0,
        distribuicaoSituacoes: {},
        ultimaAtualizacao: null,
        verbasComMultiplasDecisoes: 0,
        verbasComMudancaSituacao: 0
      };
    }

    return calcularEstatisticasRelatorio(
      verbasDoProcesso,
      decisionsDoProcesso,
      documentosDoProcesso
    );
  }, [verbasDoProcesso, decisionsDoProcesso, documentosDoProcesso, selectedProcess]);

  const toggleVerbaExpansion = useCallback((verbaId: string) => {
    setExpandedVerbas(prev => ({
      ...prev,
      [verbaId]: !prev[verbaId]
    }));
  }, []);

  const expandAllVerbas = useCallback(() => {
    const allExpanded = verbasAgrupadas.reduce((acc, verba) => ({
      ...acc,
      [verba.verbaId]: true
    }), {});
    setExpandedVerbas(allExpanded);
  }, [verbasAgrupadas]);

  const collapseAllVerbas = useCallback(() => {
    setExpandedVerbas({});
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleExportPDF = useCallback(() => {
    if (!selectedProcess) {
      toast.warning('Nenhum processo selecionado');
      return;
    }

    try {
      logger.info(`Imprimindo: ${selectedProcess.numeroProcesso}`, 'RelatorioVerbas.exportPDF');
      window.print();
      logger.success('Dialogo de impressao aberto', 'RelatorioVerbas.exportPDF');
    } catch (error) {
      logger.errorWithException('Erro ao imprimir', error as Error, 'RelatorioVerbas.exportPDF');
      toast.error('Erro ao abrir dialogo de impressao.');
    }
  }, [selectedProcess, toast]);

  useEffect(() => {
    const handleBeforePrint = () => {
      previousExpandedStateRef.current = expandedVerbas;

      const allExpanded = verbasAgrupadas.reduce((acc, verba) => ({
        ...acc,
        [verba.verbaId]: true
      }), {});
      setExpandedVerbas(allExpanded);

      setVisibleDecisionsCount(decisionsDoProcesso.length);
      setVisibleDocumentosCount(documentosDoProcesso.length);
      setVisibleVerbasCount(verbasAgrupadas.length);
    };

    const handleAfterPrint = () => {
      setExpandedVerbas(previousExpandedStateRef.current);
      setVisibleDecisionsCount(ITEMS_PER_SECTION);
      setVisibleDocumentosCount(ITEMS_PER_SECTION);
      setVisibleVerbasCount(ITEMS_PER_SECTION);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [expandedVerbas, verbasAgrupadas, decisionsDoProcesso.length, documentosDoProcesso.length]);

  const renderEmptyState = () => (
    <EmptyState
      icon={<BarChart3 size={48} />}
      iconColor="text-gray-400"
      title="Relatorio de Verbas Trabalhistas"
      description="Selecione um processo para gerar o relatorio detalhado."
      action={{
        label: "Ir para Lista de Processos",
        onClick: onBackToProcessList
      }}
    />
  );

  const renderNavigationIndex = () => {
    if (!selectedProcess) return null;

    const sections = [
      { id: 'decisoes', label: 'Decisoes Judiciais', count: estatisticas.totalDecisoes },
      { id: 'documentos', label: 'Lancamentos de Documentos', count: estatisticas.totalDocumentos },
      { id: 'verbas', label: 'Verbas Trabalhistas', count: estatisticas.totalTiposVerba }
    ].filter(section => section.count > 0);

    if (sections.length === 0) return null;

    return (
      <div className="border-b border-gray-200 pb-4 mb-6 no-print">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Navegacao</div>
        <div className="flex flex-wrap gap-4">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className="text-sm text-gray-600 hover:text-gray-900 hover:underline transition-colors"
            >
              {section.label} ({section.count})
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderCabecalhoRelatorio = () => {
    if (!selectedProcess) return null;

    return (
      <div className="mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Relatorio de Revisao de Verbas Trabalhistas
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Analise detalhada do processo
            </p>
          </div>

          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handleExportPDF}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm"
            >
              <FileText size={16} />
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={onBackToProcessList}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded p-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Numero:</span>
              <span className="ml-2 text-gray-900 font-mono">{selectedProcess.numeroProcesso}</span>
            </div>
            <div>
              <span className="text-gray-500">Criado em:</span>
              <span className="ml-2 text-gray-900">{formatarDataCurta(selectedProcess.dataCriacao)}</span>
            </div>
            <div>
              <span className="text-gray-500">Reclamante:</span>
              <span className="ml-2 text-gray-900">{selectedProcess.reclamante}</span>
            </div>
            <div>
              <span className="text-gray-500">Reclamada:</span>
              <span className="ml-2 text-gray-900">{selectedProcess.reclamada}</span>
            </div>
            {estatisticas.ultimaAtualizacao && (
              <div className="col-span-2 pt-2 border-t border-gray-200 mt-2">
                <span className="text-gray-500">Ultima atualizacao:</span>
                <span className="ml-2 text-gray-900">{formatarDataCurta(estatisticas.ultimaAtualizacao)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLancamentoCard = useCallback((lancamento: VerbaLancamento, index: number) => {
    return (
      <div
        key={lancamento.id}
        className="lancamento-item py-3 border-b border-gray-100 last:border-b-0"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400 font-mono text-xs">{index + 1}.</span>
            <span className="text-gray-900">{lancamento.decisaoVinculada}</span>
            {lancamento.paginaVinculada && (
              <span className="text-gray-400 text-xs">p. {lancamento.paginaVinculada}</span>
            )}
          </div>
          <span className={`text-sm font-medium ${getSituacaoStyle(lancamento.situacao)}`}>
            {lancamento.situacao}
          </span>
        </div>

        {lancamento.fundamentacao && (
          <div className="text-sm text-gray-600 mt-2 pl-6">
            <span className="font-medium text-gray-700">Fundamentacao: </span>
            <span dangerouslySetInnerHTML={{ __html: lancamento.fundamentacao }} />
          </div>
        )}

        {lancamento.comentariosCalculistas && (
          <div className="text-sm text-gray-600 mt-2 pl-6">
            <span className="font-medium text-gray-700">Comentarios: </span>
            <span dangerouslySetInnerHTML={{ __html: lancamento.comentariosCalculistas }} />
          </div>
        )}

        <div className="text-xs text-gray-400 mt-2 pl-6">
          {formatarData(lancamento.dataCriacao)}
        </div>
      </div>
    );
  }, []);

  const renderVerbasSection = () => {
    if (!selectedProcess || verbasAgrupadas.length === 0) {
      return null;
    }

    return (
      <section id="verbas" className="mt-8 scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <Scale size={18} className="text-gray-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Verbas Trabalhistas
              </h2>
              <p className="text-sm text-gray-500">
                {estatisticas.totalTiposVerba} tipo{estatisticas.totalTiposVerba !== 1 ? 's' : ''} de verba, {estatisticas.totalLancamentos} lancamento{estatisticas.totalLancamentos !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            <button
              onClick={expandAllVerbas}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Expandir todas
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAllVerbas}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Recolher todas
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {visibleVerbas.map((verba, index) => {
            const isExpanded = expandedVerbas[verba.verbaId] ?? false;
            const temMudancaSituacao = verificarMudancaSituacao(verba);

            return (
              <div
                key={verba.verbaId}
                className="verba-card border border-gray-200 rounded bg-white"
              >
                <button
                  onClick={() => toggleVerbaExpansion(verba.verbaId)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors print-visible"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-mono text-sm">{index + 1}.</span>
                      <h3 className="font-medium text-gray-900">{verba.tipoVerba}</h3>
                      {temMudancaSituacao && (
                        <span className="text-xs text-amber-600 font-medium">
                          (mudanca de situacao)
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 pl-6">
                      {verba.lancamentos.length} lancamento{verba.lancamentos.length !== 1 ? 's' : ''} - {formatarResumoSituacoes(verba.resumoSituacoes)}
                    </div>
                  </div>

                  <div className="ml-4 no-print text-gray-400">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                <div
                  className="px-4 pb-3 border-t border-gray-100 verba-lancamentos"
                  style={{ display: isExpanded ? 'block' : 'none' }}
                >
                  <div className="pl-6">
                    {verba.lancamentos.map((lancamento, lancIndex) =>
                      renderLancamentoCard(lancamento, lancIndex)
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasMoreVerbas && (
          <div className="mt-4 text-center no-print">
            <button
              onClick={() => setVisibleVerbasCount(prev => prev + ITEMS_PER_SECTION)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ChevronDown size={16} />
              <span>Carregar mais ({verbasAgrupadas.length - visibleVerbasCount} restantes)</span>
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderDecisionsSection = () => {
    if (decisionsDoProcesso.length === 0) {
      return null;
    }

    return (
      <section id="decisoes" className="mt-8 scroll-mt-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
            <Gavel size={18} className="text-gray-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Decisoes Judiciais
            </h2>
            <p className="text-sm text-gray-500">
              {decisionsDoProcesso.length} decisao{decisionsDoProcesso.length !== 1 ? 'es' : ''} vinculada{decisionsDoProcesso.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="border border-gray-200 rounded bg-white divide-y divide-gray-100">
          {visibleDecisions.map((decision, index) => (
            <div
              key={decision.id}
              className="decision-card px-4 py-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-mono text-sm">{index + 1}.</span>
                  <span className="font-medium text-gray-900">{decision.tipoDecisao}</span>
                  <span className="text-sm text-gray-500">{decision.idDecisao}</span>
                  {decision.paginaVinculada && (
                    <span className="text-xs text-gray-400">p. {decision.paginaVinculada}</span>
                  )}
                </div>
                <span className={`text-sm font-medium ${getSituacaoStyle(decision.situacao)}`}>
                  {decision.situacao}
                </span>
              </div>

              {decision.observacoes && (
                <div className="text-sm text-gray-600 pl-6">
                  <span className="font-medium text-gray-700">Observacoes: </span>
                  <span dangerouslySetInnerHTML={{ __html: decision.observacoes }} />
                </div>
              )}

              <div className="text-xs text-gray-400 mt-2 pl-6">
                {formatarData(decision.dataCriacao)}
              </div>
            </div>
          ))}
        </div>

        {hasMoreDecisions && (
          <div className="mt-4 text-center no-print">
            <button
              onClick={() => setVisibleDecisionsCount(prev => prev + ITEMS_PER_SECTION)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ChevronDown size={16} />
              <span>Carregar mais ({decisionsDoProcesso.length - visibleDecisionsCount} restantes)</span>
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderDocumentosSection = () => {
    if (documentosDoProcesso.length === 0) {
      return null;
    }

    return (
      <section id="documentos" className="mt-8 scroll-mt-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-gray-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Lancamentos de Documentos
            </h2>
            <p className="text-sm text-gray-500">
              {documentosDoProcesso.length} documento{documentosDoProcesso.length !== 1 ? 's' : ''} vinculado{documentosDoProcesso.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="border border-gray-200 rounded bg-white divide-y divide-gray-100">
          {visibleDocumentos.map((documento, index) => (
            <div
              key={documento.id}
              className="documento-card px-4 py-3"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gray-400 font-mono text-sm">{index + 1}.</span>
                <span className="font-medium text-gray-900">{documento.tipoDocumento}</span>
                {documento.paginaVinculada && (
                  <span className="text-xs text-gray-400">p. {documento.paginaVinculada}</span>
                )}
              </div>

              {documento.comentarios && (
                <div className="text-sm text-gray-600 pl-6">
                  <span className="font-medium text-gray-700">Comentarios: </span>
                  <span dangerouslySetInnerHTML={{ __html: documento.comentarios }} />
                </div>
              )}

              <div className="text-xs text-gray-400 mt-2 pl-6">
                {formatarData(documento.dataCriacao)}
              </div>
            </div>
          ))}
        </div>

        {hasMoreDocumentos && (
          <div className="mt-4 text-center no-print">
            <button
              onClick={() => setVisibleDocumentosCount(prev => prev + ITEMS_PER_SECTION)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ChevronDown size={16} />
              <span>Carregar mais ({documentosDoProcesso.length - visibleDocumentosCount} restantes)</span>
            </button>
          </div>
        )}
      </section>
    );
  };

  if (!selectedProcess) {
    return renderEmptyState();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="print-header no-screen">
        <div className="print-header-content">
          <div className="print-header-logo">
            <img
              src="https://calculopro.com.br/wp-content/uploads/2024/11/logonegativa.png"
              alt="CalculoPro"
            />
          </div>
          <div className="print-header-contact">
            <div className="contact-name">Leonardo G. Cristiano</div>
            <div className="contact-phone">Tel: (14) 99606-7654</div>
            <div className="contact-email">contato@calculopro.com.br</div>
          </div>
        </div>
      </header>

      <div ref={observerTargetRef} className="h-1" />

      {renderCabecalhoRelatorio()}
      {renderNavigationIndex()}
      {renderDecisionsSection()}
      {renderDocumentosSection()}
      {renderVerbasSection()}

      <footer className="print-footer no-screen">
        <div className="print-footer-content">
          <div className="print-footer-address">
            <div>R. Mario Gonzaga Junqueira, 25-80</div>
            <div>Jardim Viaduto, Bauru - SP, 17055-210</div>
            <div>www.calculopro.com.br</div>
          </div>
          <div className="print-footer-company">
            CalculoPro Ltda. 51.540.075/0001-04
          </div>
        </div>
      </footer>

      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded shadow-lg transition-colors z-50 no-print"
          title="Voltar ao topo"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
};

export default React.memo(RelatorioVerbas);
