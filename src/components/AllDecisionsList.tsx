import React, { useState, useMemo, useCallback } from 'react';
import { Scale, Search, ChevronDown } from 'lucide-react';
import { Decision, DecisionFilter } from '../types/Decision';
import { Process } from '../types/Process';
import logger from '../utils/logger';
import { getPreviewText, hasLongText, PREVIEW_LENGTHS } from '../utils/previewText';

const ITEMS_PER_PAGE = 5;

interface AllDecisionsListProps {
  decisions: Decision[];
  processes: Process[];
  onSelectProcess?: (process: Process) => void;
}

const AllDecisionsList: React.FC<AllDecisionsListProps> = ({
  decisions,
  processes,
  onSelectProcess
}) => {
  const [filter, setFilter] = useState<DecisionFilter>({ searchTerm: '' });
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [visibleProcessCount, setVisibleProcessCount] = useState(ITEMS_PER_PAGE);

  const filteredDecisions = useMemo(() => {
    return decisions.filter((decision) => {
      const searchTerm = filter.searchTerm.toLowerCase();
      if (!searchTerm) return true;

      const relatedProcess = processes.find(p => p.id === decision.processId);

      return (
        decision.idDecisao.toLowerCase().includes(searchTerm) ||
        decision.tipoDecisao.toLowerCase().includes(searchTerm) ||
        decision.situacao.toLowerCase().includes(searchTerm) ||
        (decision.observacoes && decision.observacoes.toLowerCase().includes(searchTerm)) ||
        (relatedProcess && relatedProcess.numeroProcesso.toLowerCase().includes(searchTerm)) ||
        (relatedProcess && relatedProcess.reclamante.toLowerCase().includes(searchTerm))
      );
    });
  }, [decisions, processes, filter.searchTerm]);

  const groupedDecisions = useMemo(() => {
    return filteredDecisions.reduce((groups, decision) => {
      const processId = decision.processId;
      if (!groups[processId]) {
        groups[processId] = [];
      }
      groups[processId].push(decision);
      return groups;
    }, {} as Record<string, Decision[]>);
  }, [filteredDecisions]);

  const processIds = useMemo(() => {
    return Object.keys(groupedDecisions).filter(id => processes.find(p => p.id === id));
  }, [groupedDecisions, processes]);

  const visibleProcessIds = useMemo(() => {
    return processIds.slice(0, visibleProcessCount);
  }, [processIds, visibleProcessCount]);

  const hasMoreProcesses = processIds.length > visibleProcessCount;
  const remainingProcesses = processIds.length - visibleProcessCount;

  const getProcessById = useCallback((processId: string): Process | undefined => {
    return processes.find(process => process.id === processId);
  }, [processes]);

  const handleNavigateToProcess = useCallback((process: Process) => {
    logger.info(
      `Navegacao para processo a partir da aba de decisoes: ${process.numeroProcesso}`,
      'AllDecisionsList - handleNavigateToProcess',
      { processId: process.id, reclamante: process.reclamante }
    );

    if (onSelectProcess) {
      onSelectProcess(process);
    }
  }, [onSelectProcess]);

  const handleSearchChange = useCallback((searchTerm: string) => {
    setFilter({ searchTerm });
    setVisibleProcessCount(ITEMS_PER_PAGE);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleProcessCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('pt-BR');
  }, []);

  const formatDecisionId = useCallback((id: string): string => {
    return id.length > 8 ? `${id.substring(0, 7)}...` : id;
  }, []);

  const toggleCardExpansion = useCallback((decisionId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(decisionId)) {
        newSet.delete(decisionId);
      } else {
        newSet.add(decisionId);
      }
      return newSet;
    });
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Todas as Decisoes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Visao global de todas as decisoes judiciais para revisao ({filteredDecisions.length} decisoes)
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por ID, tipo, situacao, processo ou reclamante..."
            value={filter.searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-14 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
          />
        </div>
      </div>

      <div className="p-6">
        {processIds.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Scale className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter.searchTerm ? 'Nenhuma decisao encontrada' : 'Nenhuma decisao cadastrada'}
            </h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              {filter.searchTerm
                ? 'Tente ajustar os termos de busca para encontrar decisoes especificas'
                : 'As decisoes judiciais aparecem aqui conforme sao cadastradas nos processos'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-8">
              {visibleProcessIds.map((processId) => {
                const process = getProcessById(processId);
                const processDecisions = groupedDecisions[processId];

                if (!process) return null;

                return (
                  <div key={processId} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {process.numeroProcesso}
                        </h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Reclamante:</span> {process.reclamante}</p>
                          <p><span className="font-medium">Reclamada:</span> {process.reclamada}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-gray-500 mb-2">
                          {processDecisions.length} decisao{processDecisions.length !== 1 ? 'es' : ''}
                        </div>

                        {onSelectProcess && (
                          <button
                            onClick={() => handleNavigateToProcess(process)}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200"
                          >
                            Ver Processo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-base font-medium text-gray-900">Decisoes</h4>

                      <ul className="space-y-2">
                        {processDecisions.map((decision) => {
                          const isCardExpanded = expandedCards.has(decision.id);
                          const showExpandButton = decision.observacoes && hasLongText(decision.observacoes);

                          return (
                            <li key={decision.id} className="flex items-start">
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3"></div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium">{decision.tipoDecisao}</span>
                                  <span className="text-gray-600"> (ID: {formatDecisionId(decision.idDecisao)}) - </span>
                                  <span className="text-gray-600">Situacao: </span>
                                  <span className="font-medium">{decision.situacao}</span>
                                </p>

                                {decision.observacoes && (
                                  <div className="mt-1">
                                    {!isCardExpanded ? (
                                      <p className="text-xs text-gray-600 italic leading-relaxed">
                                        {getPreviewText(decision.observacoes, PREVIEW_LENGTHS.LIST_VIEW)}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-700 leading-relaxed">
                                        {decision.observacoes}
                                      </p>
                                    )}
                                    {showExpandButton && (
                                      <button
                                        onClick={() => toggleCardExpansion(decision.id)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                                      >
                                        {isCardExpanded ? 'Ver menos' : 'Ver mais'}
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="text-xs text-gray-400 mt-1">
                                  Criado em: {formatDate(decision.dataCriacao)}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMoreProcesses && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ChevronDown size={16} />
                  <span>Carregar mais ({remainingProcesses} processos restantes)</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(AllDecisionsList);
