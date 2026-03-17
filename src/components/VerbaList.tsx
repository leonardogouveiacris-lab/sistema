/**
 * Componente VerbaList - Lista hierárquica de verbas
 * Exibe verbas com estrutura Verba > Lançamentos (Decisões)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DollarSign, Scale, Search, Trash2, CreditCard as Edit2, Calculator, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Verba, VerbaLancamento, VerbaFilter, NewVerbaLancamento, ChecklistStats, ChecklistStatus } from '../types/Verba';
import { Decision } from '../types/Decision';
import VerbaEditModal from './VerbaEditModal';
import VerbaChecklistProgress from './VerbaChecklistProgress';
import { VerbasService } from '../services/verbas.service';
import logger from '../utils/logger';
import { hasLongText } from '../utils/previewText';
import { LancamentoRefRenderer } from './ui';
import { useLancamentosForReference } from '../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../hooks/useNavigateToReference';
import { useProcessTable } from '../hooks/useProcessTable';
import { useToast } from '../contexts/ToastContext';

/**
 * Props do componente VerbaList
 */
interface VerbaListProps {
  processId: string;                           // ID do processo para filtrar as verbas
  verbas: Verba[];                            // Todas as verbas do sistema
  decisions: Decision[];                       // Todas as decisões para referência
  onSelectVerba?: (verba: Verba) => void;     // Callback opcional para seleção
  onUpdateVerba?: (verbaId: string, lancamentoId: string, updatedData: Partial<NewVerbaLancamento>) => Promise<void> | void;
  onRemoveVerba?: (verbaId: string, lancamentoId: string) => Promise<void> | void;
  onVerbasUpdated?: () => void;               // Callback quando verbas são atualizadas
  refreshVerbas?: () => Promise<void>;        // Callback para recarregar verbas do banco
  onForceRefreshVerbas?: () => Promise<void>; // Callback para forçar refresh após rename
}

/**
 * Componente VerbaList com estrutura hierárquica
 */
const VerbaList: React.FC<VerbaListProps> = ({ 
  processId, 
  verbas,
  decisions,
  onSelectVerba, 
  onUpdateVerba,
  onRemoveVerba,
  onVerbasUpdated,
  refreshVerbas,
  onForceRefreshVerbas
}) => {
  const sortLancamentosByPagina = useCallback((lancamentos: VerbaLancamento[]): VerbaLancamento[] => {
    return [...lancamentos].sort((a, b) => {
      const aPagina = a.paginaVinculada;
      const bPagina = b.paginaVinculada;

      if (aPagina !== null && aPagina !== undefined && bPagina !== null && bPagina !== undefined) {
        return aPagina - bPagina;
      }

      if (aPagina !== null && aPagina !== undefined) {
        return -1;
      }

      if (bPagina !== null && bPagina !== undefined) {
        return 1;
      }

      return new Date(a.dataCriacao).getTime() - new Date(b.dataCriacao).getTime();
    });
  }, []);

  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);
  const navigateToReference = useNavigateToReference(processId);
  const toast = useToast();

  // Estado do filtro de pesquisa para busca dinâmica
  const [filter, setFilter] = useState<VerbaFilter>({ searchTerm: '' });

  // Estado do modal de edição
  const [editingLancamento, setEditingLancamento] = useState<{ verba: Verba; lancamento: VerbaLancamento } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado de expansão dos cards para "Ver mais"
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Estado de confirmação de exclusão inline por lançamento
  const [deletingLancamentoId, setDeletingLancamentoId] = useState<string | null>(null);

  // Estado do checklist
  const [checklistFilter, setChecklistFilter] = useState<ChecklistStatus | 'todos'>('todos');
  const [checklistStats, setChecklistStats] = useState<ChecklistStats>({
    total: 0,
    pendentes: 0,
    aguardandoRevisao: 0,
    concluidos: 0,
    percentualConcluido: 0
  });
  const [checkLoading, setCheckLoading] = useState<Record<string, boolean>>({});

  const toggleCardExpansion = useCallback((lancamentoId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lancamentoId)) {
        newSet.delete(lancamentoId);
      } else {
        newSet.add(lancamentoId);
      }
      return newSet;
    });
  }, []);

  /**
   * Calcula as estatísticas do checklist baseado nos lançamentos
   */
  const calculateChecklistStats = useCallback(() => {
    const processVerbas = verbas.filter(verba => verba.processId === processId);
    const allLancamentos = processVerbas.flatMap(v => v.lancamentos);

    const total = allLancamentos.length;
    const pendentes = allLancamentos.filter(l => !l.checkCalculista && !l.checkRevisor).length;
    const aguardandoRevisao = allLancamentos.filter(l => l.checkCalculista && !l.checkRevisor).length;
    const concluidos = allLancamentos.filter(l => l.checkCalculista && l.checkRevisor).length;
    const percentualConcluido = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    setChecklistStats({ total, pendentes, aguardandoRevisao, concluidos, percentualConcluido });
  }, [verbas, processId]);

  useEffect(() => {
    calculateChecklistStats();
  }, [calculateChecklistStats]);

  /**
   * Filtra verbas baseado no processo atual e termo de busca
   */
  const filteredVerbas = useMemo(() => {
    // Primeiro filtro: apenas verbas deste processo
    let processVerbas = verbas.filter(verba => verba.processId === processId);

    // Segundo filtro: termo de busca (se houver)
    const searchTerm = filter.searchTerm.toLowerCase();
    if (searchTerm) {
      processVerbas = processVerbas.filter(verba =>
        verba.tipoVerba.toLowerCase().includes(searchTerm) ||
        verba.lancamentos.some(lancamento =>
          lancamento.decisaoVinculada.toLowerCase().includes(searchTerm) ||
          lancamento.situacao.toLowerCase().includes(searchTerm) ||
          (lancamento.fundamentacao && lancamento.fundamentacao.toLowerCase().includes(searchTerm)) ||
          (lancamento.comentariosCalculistas && lancamento.comentariosCalculistas.toLowerCase().includes(searchTerm))
        )
      );
    }

    // Terceiro filtro: status do checklist
    if (checklistFilter !== 'todos') {
      processVerbas = processVerbas.map(verba => ({
        ...verba,
        lancamentos: verba.lancamentos.filter(lancamento => {
          if (checklistFilter === 'pendente') {
            return !lancamento.checkCalculista && !lancamento.checkRevisor;
          } else if (checklistFilter === 'aguardando_revisao') {
            return lancamento.checkCalculista && !lancamento.checkRevisor;
          } else if (checklistFilter === 'concluido') {
            return lancamento.checkCalculista && lancamento.checkRevisor;
          }
          return true;
        })
      })).filter(verba => verba.lancamentos.length > 0);
    }

    return processVerbas;
  }, [verbas, processId, filter.searchTerm, checklistFilter]);

  /**
   * Conta total de lançamentos nas verbas filtradas
   */
  const totalLancamentos = useMemo(() => {
    return filteredVerbas.reduce((acc, verba) => acc + verba.lancamentos.length, 0);
  }, [filteredVerbas]);

  /**
   * Encontra informações da decisão vinculada
   */
  const getDecisionInfo = useCallback((decisaoVinculada: string): Decision | undefined => {
    // A decisão vinculada está no formato "ID - Tipo", extraímos apenas o ID
    const decisionId = decisaoVinculada.split(' - ')[0];
    return decisions.find(d => d.idDecisao === decisionId);
  }, [decisions]);

  /**
   * Abre o modal de edição para um lançamento específico
   */
  const handleEditLancamento = useCallback((verba: Verba, lancamento: VerbaLancamento) => {
    setEditingLancamento({ verba, lancamento });
    setIsModalOpen(true);
  }, []);

  /**
   * Fecha o modal de edição e limpa o estado
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingLancamento(null);
  }, []);

  /**
   * Processa o salvamento das alterações do lançamento
   */
  const handleSaveLancamento = useCallback(async (updatedData: Partial<NewVerbaLancamento>) => {
    if (!editingLancamento) return;

    try {
      if (onUpdateVerba) {
        await onUpdateVerba(editingLancamento.verba.id, editingLancamento.lancamento.id, updatedData);
        if (onVerbasUpdated) {
          onVerbasUpdated();
        }
      }
      handleCloseModal();

    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar alterações no lançamento',
        error as Error,
        'VerbaList - handleSaveLancamento',
        { 
          verbaId: editingLancamento.verba.id,
          lancamentoId: editingLancamento.lancamento.id,
          updatedData 
        }
      );
      
      // Re-lança o erro para que o modal possa lidar com ele
      throw error;
    }
  }, [editingLancamento, onUpdateVerba, handleCloseModal]);


  /**
   * Effect para escutar eventos de atualização de verbas
  * Força refresh quando verbas são alteradas (rename, etc)
   */
  useEffect(() => {
   const handleVerbasUpdated = async () => {
      // Força recarregamento das verbas do banco
      if (refreshVerbas) {
        try {
          await refreshVerbas();
        } catch (error) {
          logger.errorWithException(
            'Lista: Erro ao recarregar verbas do banco',
            error as Error,
            'VerbaList - verbasUpdatedEvent'
          );
        }
      }

      // Notifica componente pai sobre mudanças
      if (onVerbasUpdated) {
        onVerbasUpdated();
      }
    };

    // Escuta eventos de atualização de verbas
    window.addEventListener('verbas-updated', handleVerbasUpdated);
    
    return () => {
      window.removeEventListener('verbas-updated', handleVerbasUpdated);
    };
  }, [onVerbasUpdated, refreshVerbas, processId]);

  /**
   * Lida com a seleção de uma verba
   */
  const handleSelectVerba = useCallback((verba: Verba) => {
    if (onSelectVerba) {
      onSelectVerba(verba);
    }
  }, [onSelectVerba]);

  /**
   * Lida com a exclusão de um lançamento
   */
  const handleDeleteLancamento = useCallback(async (verba: Verba, lancamento: VerbaLancamento) => {
    if (onRemoveVerba) {
      await onRemoveVerba(verba.id, lancamento.id);
      setDeletingLancamentoId(null);
    }
  }, [onRemoveVerba]);

  /**
   * Alterna o check do calculista
   */
  const handleToggleCalculista = useCallback(async (lancamentoId: string, currentValue: boolean) => {
    setCheckLoading(prev => ({ ...prev, [`calc-${lancamentoId}`]: true }));
    try {
      await VerbasService.toggleCheckCalculista(lancamentoId, !currentValue);
      await VerbasService.updateProcessVerbaStatus(processId);
      if (refreshVerbas) {
        await refreshVerbas();
      }
    } catch (error) {
      logger.errorWithException(
        'Erro ao alternar check calculista',
        error as Error,
        'VerbaList - handleToggleCalculista'
      );
      toast.error('Não foi possível atualizar o check do calculista.');
    } finally {
      setCheckLoading(prev => ({ ...prev, [`calc-${lancamentoId}`]: false }));
    }
  }, [processId, refreshVerbas]);

  /**
   * Alterna o check do revisor
   */
  const handleToggleRevisor = useCallback(async (lancamentoId: string, currentValue: boolean, checkCalculista: boolean) => {
    if (!checkCalculista && !currentValue) {
      logger.warn(
        'Tentativa de marcar revisao sem check do calculista',
        'VerbaList - handleToggleRevisor'
      );
      return;
    }

    setCheckLoading(prev => ({ ...prev, [`rev-${lancamentoId}`]: true }));
    try {
      await VerbasService.toggleCheckRevisor(lancamentoId, !currentValue);
      await VerbasService.updateProcessVerbaStatus(processId);
      if (refreshVerbas) {
        await refreshVerbas();
      }
    } catch (error) {
      logger.errorWithException(
        'Erro ao alternar check revisor',
        error as Error,
        'VerbaList - handleToggleRevisor'
      );
      toast.error('Não foi possível atualizar o check do revisor.');
    } finally {
      setCheckLoading(prev => ({ ...prev, [`rev-${lancamentoId}`]: false }));
    }
  }, [processId, refreshVerbas]);

  /**
   * Formata a data brasileira para exibição
   */
  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('pt-BR');
  }, []);

  /**
   * Gera cor do badge baseado na situação
   */
  const getSituacaoBadgeColor = useCallback((situacao: string): string => {
    switch (situacao) {
      case 'Deferida':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Indeferida':
      case 'Excluída':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Parcialmente Deferida':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Reformada':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Em Análise':
      case 'Aguardando Documentação':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  return (
    <div>
      {/* Barra de progresso do checklist */}
      <VerbaChecklistProgress
        stats={checklistStats}
        filterStatus={checklistFilter}
        onFilterChange={setChecklistFilter}
      />

      <div className="bg-white rounded-lg border border-gray-200">
        {/* Cabeçalho da seção */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Verbas Cadastradas ({totalLancamentos} lançamentos)
            </h3>

            {/* Botão de refresh manual */}
            <button
              onClick={async () => {
                if (refreshVerbas) {
                  await refreshVerbas();
                }
              }}
              className="inline-flex items-center space-x-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors duration-200"
              title="Atualizar lista de verbas"
            >
              <span className="text-xs">⟳</span>
              <span>Atualizar</span>
            </button>
          </div>

          {/* Barra de pesquisa - apenas exibida quando há verbas deste processo */}
          {filteredVerbas.length > 1 && (
            <div className="mt-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar por tipo, decisão, situação ou conteúdo..."
                value={filter.searchTerm}
                onChange={(e) => setFilter({ searchTerm: e.target.value })}
                className="block w-full pl-14 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              />
            </div>
          )}
        </div>

        {/* Conteúdo principal da lista */}
        <div className="p-6">
          {filteredVerbas.length === 0 ? (
            /* Estado vazio */
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <DollarSign className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter.searchTerm ? 'Nenhuma verba encontrada' : 'Nenhuma verba cadastrada'}
              </h3>
              <p className="text-gray-500 text-sm">
                {filter.searchTerm 
                  ? 'Tente ajustar os termos de busca para encontrar verbas específicas' 
                  : 'Cadastre a primeira verba usando o formulário acima'
                }
              </p>
            </div>
          ) : (
            /* Lista hierárquica de verbas */
            <div className="space-y-6">
              {filteredVerbas.map((verba) => (
                <div
                  key={verba.id}
                  className="border border-gray-200 rounded-lg p-6 bg-gray-50"
                >
                  {/* Cabeçalho da verba */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {verba.tipoVerba}
                      </h4>
                      <div className="text-sm text-gray-600 space-x-4">
                        <span>{verba.lancamentos.length} lançamento{verba.lancamentos.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>Criado em: {formatDate(verba.dataCriacao)}</span>
                      </div>
                    </div>
                    
                    {/* Badge de tipo de verba */}
                    <div className="bg-white px-3 py-1 rounded-full border border-gray-300">
                      <span className="text-sm font-medium text-gray-700">
                        {verba.tipoVerba}
                      </span>
                    </div>
                  </div>

                  {/* Lista de lançamentos da verba */}
                  <div className="space-y-3">
                    <h5 className="text-base font-medium text-gray-900 flex items-center">
                      <Scale className="mr-2" size={16} />
                      Lançamentos
                    </h5>
                    
                    <div className="space-y-3">
                      {sortLancamentosByPagina(verba.lancamentos).map((lancamento) => {
                        const isCardExpanded = expandedCards.has(lancamento.id);
                        const hasLongFundamentacao = hasLongText(lancamento.fundamentacao);
                        const hasLongComentarios = hasLongText(lancamento.comentariosCalculistas);
                        const showExpandButton = hasLongFundamentacao || hasLongComentarios;
                        const isConfirmingDelete = deletingLancamentoId === lancamento.id;

                        return (
                        <div
                          key={lancamento.id}
                          className={`bg-white border rounded-lg overflow-hidden group hover:shadow-sm transition-all duration-200 ${isConfirmingDelete ? 'border-red-200' : 'border-gray-200'}`}
                        >
                          <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="font-medium text-gray-900 text-sm">
                                  {lancamento.decisaoVinculada}
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSituacaoBadgeColor(lancamento.situacao)}`}>
                                  {lancamento.situacao}
                                </span>
                                {lancamento.paginaVinculada != null && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-md">
                                    p.{lancamento.paginaVinculada}
                                  </span>
                                )}
                              </div>

                              {lancamento.fundamentacao && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Fundamentação:</span>{' '}
                                  <LancamentoRefRenderer
                                    html={lancamento.fundamentacao}
                                    referenceItems={referenceItems}
                                    onNavigate={navigateToReference}
                                    className={`inline text-gray-500 ${!isCardExpanded ? 'line-clamp-3' : ''}`}
                                  />
                                </div>
                              )}

                              {lancamento.comentariosCalculistas && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Comentários:</span>{' '}
                                  <LancamentoRefRenderer
                                    html={lancamento.comentariosCalculistas}
                                    referenceItems={referenceItems}
                                    onNavigate={navigateToReference}
                                    className={`inline text-gray-500 ${!isCardExpanded ? 'line-clamp-3' : ''}`}
                                  />
                                </div>
                              )}

                              {showExpandButton && (
                                <button
                                  onClick={() => toggleCardExpansion(lancamento.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                                >
                                  {isCardExpanded ? 'Ver menos' : 'Ver mais'}
                                </button>
                              )}

                              <div className="text-xs text-gray-400">
                                Lançado em: {formatDate(lancamento.dataCriacao)}
                              </div>

                              <div className="flex items-center space-x-4 pt-2 mt-2 border-t border-gray-100">
                                <button
                                  onClick={() => handleToggleCalculista(lancamento.id, lancamento.checkCalculista)}
                                  disabled={checkLoading[`calc-${lancamento.id}`]}
                                  className={`
                                    inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200
                                    ${lancamento.checkCalculista
                                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }
                                    ${checkLoading[`calc-${lancamento.id}`] ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                  `}
                                  title={lancamento.checkCalculista ? 'Desmarcar calculo concluido' : 'Marcar calculo concluido'}
                                >
                                  <Calculator size={12} className="mr-1.5" />
                                  <span>Calculista</span>
                                  {lancamento.checkCalculista && (
                                    <span className="ml-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  )}
                                </button>

                                <button
                                  onClick={() => handleToggleRevisor(lancamento.id, lancamento.checkRevisor, lancamento.checkCalculista)}
                                  disabled={!lancamento.checkCalculista || checkLoading[`rev-${lancamento.id}`]}
                                  className={`
                                    inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200
                                    ${lancamento.checkRevisor
                                      ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                                      : lancamento.checkCalculista
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    }
                                    ${checkLoading[`rev-${lancamento.id}`] ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${!lancamento.checkCalculista ? 'cursor-not-allowed' : 'cursor-pointer'}
                                  `}
                                  title={
                                    !lancamento.checkCalculista
                                      ? 'Marque o calculo primeiro'
                                      : lancamento.checkRevisor
                                        ? 'Desmarcar revisao aprovada'
                                        : 'Marcar revisao aprovada'
                                  }
                                >
                                  <ClipboardCheck size={12} className="mr-1.5" />
                                  <span>Revisor</span>
                                  {lancamento.checkRevisor && (
                                    <span className="ml-1.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  )}
                                </button>

                                {lancamento.checkCalculista && lancamento.checkRevisor && (
                                  <span className="text-xs text-green-600 font-medium">Concluído</span>
                                )}
                                {lancamento.checkCalculista && !lancamento.checkRevisor && (
                                  <span className="text-xs text-amber-600 font-medium">Aguardando revisão</span>
                                )}
                              </div>
                            </div>

                            {(onUpdateVerba || onRemoveVerba) && (
                              <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 flex-shrink-0">
                                {onUpdateVerba && (
                                  <button
                                    onClick={() => handleEditLancamento(verba, lancamento)}
                                    className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                                    title={`Editar lançamento ${lancamento.decisaoVinculada}`}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {onRemoveVerba && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingLancamentoId(isConfirmingDelete ? null : lancamento.id);
                                    }}
                                    className={`p-1.5 rounded-md transition-colors ${isConfirmingDelete ? 'text-red-700 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                                    title={`Excluir lançamento ${lancamento.decisaoVinculada}`}
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
                                  <p className="text-xs font-medium text-red-800">Excluir este lançamento?</p>
                                  <p className="text-xs text-red-600 mt-0.5">{verba.tipoVerba} · {lancamento.decisaoVinculada}</p>
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => setDeletingLancamentoId(null)}
                                      className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLancamento(verba, lancamento)}
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
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição de Lançamento */}
      {editingLancamento && (
        <VerbaEditModal
          verba={editingLancamento.verba}
          lancamento={editingLancamento.lancamento}
          decisions={decisions}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveLancamento}
          onVerbasUpdated={onVerbasUpdated}
          refreshVerbas={refreshVerbas}
          onForceRefreshVerbas={onForceRefreshVerbas}
        />
      )}
    </div>
  );
};

export default React.memo(VerbaList);
