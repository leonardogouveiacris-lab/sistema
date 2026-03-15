import React, { useState, useMemo, useCallback } from 'react';
import { Decision, NewDecision } from '../types/Decision';
import { Scale, Search, ChevronDown, ChevronUp, Filter, CreditCard as Edit2, Trash2, AlertTriangle } from 'lucide-react';
import DecisionEditModal from './DecisionEditModal';
import logger from '../utils/logger';
import { hasLongText } from '../utils/previewText';
import { sortByPagina } from '../utils/sortByPagina';
import { LancamentoRefRenderer } from './ui';
import { useLancamentosForReference } from '../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../hooks/useNavigateToReference';
import { useProcessTable } from '../hooks/useProcessTable';

const ITEMS_PER_PAGE = 10;

interface DecisionListProps {
  processId: string;
  processNumber: string;
  decisions: Decision[];
  onSelectDecision?: (decision: Decision) => void;
  onUpdateDecision?: (id: string, updatedData: Partial<NewDecision>) => Promise<void> | void;
  onRemoveDecision?: (id: string) => Promise<void> | void;
}

const DecisionList: React.FC<DecisionListProps> = ({
  processId,
  processNumber,
  decisions,
  onSelectDecision,
  onUpdateDecision,
  onRemoveDecision
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [groupByTipo, setGroupByTipo] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);
  const navigateToReference = useNavigateToReference(processId);

  const processDecisions = useMemo(() => {
    return decisions.filter(d => d.processId === processId);
  }, [decisions, processId]);

  const tiposUnicos = useMemo(() => {
    const tipos = new Set(processDecisions.map(d => d.tipoDecisao));
    return Array.from(tipos).sort();
  }, [processDecisions]);

  const filteredDecisions = useMemo(() => {
    let filtered = processDecisions;

    if (selectedTipo !== 'all') {
      filtered = filtered.filter(d => d.tipoDecisao === selectedTipo);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.tipoDecisao.toLowerCase().includes(query) ||
        d.idDecisao.toLowerCase().includes(query) ||
        d.situacao.toLowerCase().includes(query) ||
        d.observacoes?.toLowerCase().includes(query)
      );
    }

    return filtered.sort(sortByPagina);
  }, [processDecisions, selectedTipo, searchQuery]);

  const visibleDecisions = useMemo(() => {
    if (groupByTipo) return filteredDecisions;
    return filteredDecisions.slice(0, visibleCount);
  }, [filteredDecisions, visibleCount, groupByTipo]);

  const hasMoreItems = !groupByTipo && filteredDecisions.length > visibleCount;
  const remainingCount = filteredDecisions.length - visibleCount;

  const groupedDecisions = useMemo(() => {
    if (!groupByTipo) return null;

    const groups = new Map<string, Decision[]>();
    filteredDecisions.forEach(decision => {
      const tipo = decision.tipoDecisao;
      if (!groups.has(tipo)) {
        groups.set(tipo, []);
      }
      groups.get(tipo)!.push(decision);
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDecisions, groupByTipo]);

  const stats = useMemo(() => ({
    total: processDecisions.length,
    comPaginaVinculada: processDecisions.filter(d => d.paginaVinculada != null).length,
    porTipo: processDecisions.reduce((acc, d) => {
      acc[d.tipoDecisao] = (acc[d.tipoDecisao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  }), [processDecisions]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleTipoChange = useCallback((value: string) => {
    setSelectedTipo(value);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleEditDecision = (decision: Decision) => {
    setEditingDecision(decision);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDecision(null);
  };

  const handleSaveDecision = async (id: string, updatedData: Partial<NewDecision>) => {
    try {
      if (onUpdateDecision) {
        await onUpdateDecision(id, updatedData);
      }
      handleCloseModal();
    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar alteracoes na decisao',
        error as Error,
        'DecisionList - handleSaveDecision',
        { decisionId: id, updatedData }
      );

      throw error;
    }
  };

  const handleSelectDecision = (decision: Decision) => {
    if (onSelectDecision) {
      onSelectDecision(decision);
    }
  };

  const handleDeleteDecision = async (decision: Decision) => {
    if (onRemoveDecision) {
      await onRemoveDecision(decision.id);
      setDeletingCardId(null);
    }
  };

  const toggleCardExpansion = (decisionId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(decisionId)) {
        newSet.delete(decisionId);
      } else {
        newSet.add(decisionId);
      }
      return newSet;
    });
  };

  const renderDecisionCard = (decision: Decision) => {
    const isCardExpanded = expandedCards.has(decision.id);
    const showExpandButton = decision.observacoes && hasLongText(decision.observacoes);
    const isConfirmingDelete = deletingCardId === decision.id;
    const observacoesHtml = decision.observacoes || '';

    return (
      <div
        key={decision.id}
        className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all group ${isConfirmingDelete ? 'border-red-200' : 'border-gray-200'}`}
      >
        <div className="p-4 bg-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {decision.paginaVinculada != null && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md">
                    <Scale size={11} className="mr-1" />
                    p.{decision.paginaVinculada}
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900">{decision.tipoDecisao}</span>
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm text-gray-700 font-medium">{decision.idDecisao}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-gray-700 border-gray-300">
                  {decision.situacao}
                </span>
              </div>
              {observacoesHtml && (
                <div className="mb-2">
                  <LancamentoRefRenderer
                    html={observacoesHtml}
                    referenceItems={referenceItems}
                    onNavigate={navigateToReference}
                    className={`text-xs leading-relaxed ${isCardExpanded ? 'text-gray-700' : 'text-gray-600 italic line-clamp-3'}`}
                  />
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
              <div className="text-xs text-gray-400">
                {new Date(decision.dataCriacao).toLocaleDateString('pt-BR')} às{' '}
                {new Date(decision.dataCriacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {(onUpdateDecision || onRemoveDecision) && (
              <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {onUpdateDecision && (
                  <button
                    onClick={() => handleEditDecision(decision)}
                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                    title="Editar decisão"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                {onRemoveDecision && (
                  <button
                    onClick={() => setDeletingCardId(isConfirmingDelete ? null : decision.id)}
                    className={`p-1.5 rounded-md transition-colors ${isConfirmingDelete ? 'text-red-700 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                    title="Excluir decisão"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isConfirmingDelete && (
          <div className="mx-3 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800">Excluir "{decision.idDecisao}"?</p>
                <p className="text-xs text-red-600 mt-0.5">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setDeletingCardId(null)}
                    className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDeleteDecision(decision)}
                    className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (processDecisions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Scale className="text-blue-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Decisoes do Processo
            </h3>
          </div>
        </div>

        <div className="text-center py-8">
          <Scale className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-600 mb-2">Nenhuma decisao cadastrada</p>
          <p className="text-gray-500 text-sm">
            As decisoes judiciais deste processo aparecerao aqui conforme forem cadastradas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Scale className="text-blue-600" size={20} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Decisoes do Processo
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {processDecisions.length} decisao(oes) - Processo {processNumber}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isExpanded ? 'Recolher' : 'Expandir'}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar decisoes..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedTipo}
                    onChange={(e) => handleTipoChange(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todos os tipos ({stats.total})</option>
                    {tiposUnicos.map(tipo => (
                      <option key={tipo} value={tipo}>
                        {tipo} ({stats.porTipo[tipo]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => setGroupByTipo(!groupByTipo)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  groupByTipo
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Agrupar por tipo"
              >
                Agrupar
              </button>
            </div>

            {searchQuery && (
              <div className="text-xs text-gray-600">
                {filteredDecisions.length} resultado(s) encontrado(s)
              </div>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="p-6">
          {filteredDecisions.length === 0 ? (
            <div className="text-center py-8">
              <Search className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-600 mb-2">Nenhuma decisao encontrada</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTipo('all');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Limpar filtros
              </button>
            </div>
          ) : groupByTipo && groupedDecisions ? (
            <div className="space-y-4">
              {groupedDecisions.map(([tipo, decisions]) => (
                <div key={tipo} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">{tipo}</h4>
                      <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                        {decisions.length}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {decisions.map(decision => {
                      const isCardExpanded = expandedCards.has(decision.id);
                      const showExpandButton = decision.observacoes && hasLongText(decision.observacoes);

                      return (
                        <div key={decision.id} className="p-4 hover:bg-gray-50 transition-colors group">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                {decision.paginaVinculada != null && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                                    <Scale size={12} className="mr-1" />
                                    p.{decision.paginaVinculada}
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-gray-900">
                                  ID: {decision.idDecisao}
                                </span>
                                <span className="text-xs text-gray-500">-</span>
                                <span className="text-xs text-gray-600">{decision.situacao}</span>
                              </div>
                              {decision.observacoes && (
                                <div className="mb-2">
                                  <LancamentoRefRenderer
                                    html={decision.observacoes}
                                    referenceItems={referenceItems}
                                    onNavigate={navigateToReference}
                                    className={`text-xs leading-relaxed ${isCardExpanded ? 'text-gray-700' : 'text-gray-600 italic line-clamp-3'}`}
                                  />
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
                              <div className="text-xs text-gray-500">
                                {new Date(decision.dataCriacao).toLocaleDateString('pt-BR')}
                              </div>
                            </div>

                            {(onUpdateDecision || onRemoveDecision) && (
                              <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {onUpdateDecision && (
                                  <button
                                    onClick={() => handleEditDecision(decision)}
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    title="Editar decisao"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {onRemoveDecision && (
                                  <button
                                    onClick={() => handleDeleteDecision(decision)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Excluir decisao"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visibleDecisions.map(decision => renderDecisionCard(decision))}
              </div>

              {hasMoreItems && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronDown size={16} />
                    <span>Carregar mais ({remainingCount} restantes)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {editingDecision && (
        <DecisionEditModal
          decision={editingDecision}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveDecision}
        />
      )}
    </div>
  );
};

export default React.memo(DecisionList);
