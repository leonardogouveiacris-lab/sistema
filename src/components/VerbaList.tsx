/**
 * Componente VerbaList - Lista hierárquica de verbas
 * Exibe verbas com estrutura Verba > Lançamentos (Decisões)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DollarSign, Search } from 'lucide-react';
import { Verba, VerbaLancamento, VerbaFilter, NewVerbaLancamento, ChecklistStats, ChecklistStatus } from '../types/Verba';
import { Decision } from '../types/Decision';
import VerbaEditModal from './VerbaEditModal';
import VerbaChecklistProgress from './VerbaChecklistProgress';
import VerbaSection from './VerbaSection';
import { VerbasService } from '../services/verbas.service';
import logger from '../utils/logger';
import { useLancamentosForReference } from '../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../hooks/useNavigateToReference';
import { useProcessTable } from '../hooks/useProcessTable';
import { useToast } from '../contexts/ToastContext';
import { usePDFViewer } from '../contexts/PDFViewerContext';

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
  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);
  const navigateToReference = useNavigateToReference(processId);
  const toast = useToast();
  const { state: pdfState } = usePDFViewer();

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

  const checklistStats = useMemo((): ChecklistStats => {
    const processVerbas = verbas.filter(verba => verba.processId === processId);
    const allLancamentos = processVerbas.flatMap(v => v.lancamentos);
    const total = allLancamentos.length;
    const pendentes = allLancamentos.filter(l => !l.checkCalculista && !l.checkRevisor).length;
    const aguardandoRevisao = allLancamentos.filter(l => l.checkCalculista && !l.checkRevisor).length;
    const concluidos = allLancamentos.filter(l => l.checkCalculista && l.checkRevisor).length;
    const percentualConcluido = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    return { total, pendentes, aguardandoRevisao, concluidos, percentualConcluido };
  }, [verbas, processId]);

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
  }, [processId, refreshVerbas, toast]);

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
  }, [processId, refreshVerbas, toast]);

  const handleRefresh = useCallback(async () => {
    if (refreshVerbas) {
      await refreshVerbas();
    }
  }, [refreshVerbas]);

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
              onClick={handleRefresh}
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
                <VerbaSection
                  key={verba.id}
                  verba={verba}
                  expandedCards={expandedCards}
                  deletingLancamentoId={deletingLancamentoId}
                  checkLoading={checkLoading}
                  referenceItems={referenceItems}
                  activeLancamentoId={pdfState.activeLancamentoId}
                  onNavigate={navigateToReference}
                  onToggleExpansion={toggleCardExpansion}
                  onToggleCalculista={handleToggleCalculista}
                  onToggleRevisor={handleToggleRevisor}
                  onEditLancamento={handleEditLancamento}
                  onSetDeletingId={setDeletingLancamentoId}
                  onDeleteLancamento={handleDeleteLancamento}
                  canEdit={!!onUpdateVerba}
                  canDelete={!!onRemoveVerba}
                />
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
