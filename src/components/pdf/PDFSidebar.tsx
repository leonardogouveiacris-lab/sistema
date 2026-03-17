/**
 * PDFSidebar - Sidebar component for PDF viewer with tabs for decisions and verbas
 *
 * Features:
 * - Tabbed interface (Decisions / Verbas)
 * - Lists all records for the current process
 * - Inline creation and editing forms
 * - Records grouped and sorted by page
 * - Quick action buttons
 * - Empty states
 */

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { NewDecision } from '../../types/Decision';
import { NewVerbaComLancamento, VerbaLancamento } from '../../types/Verba';
import { NewDocumento } from '../../types/Documento';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce, useDecisions, useVerbas, useDocumentos, OperationResult } from '../../hooks';
import DecisionCard from './DecisionCard';
import VerbaLancamentoCard from './VerbaLancamentoCard';
import DocumentoCard from './DocumentoCard';
import CommentCard from './CommentCard';
import PDFBookmarkPanel from './PDFBookmarkPanel';
import PDFDecisionFormInline from './PDFDecisionFormInline';
import PDFVerbaFormInline from './PDFVerbaFormInline';
import PDFDocumentoFormInline from './PDFDocumentoFormInline';
import VerbaDetailModal from './VerbaDetailModal';
import DecisionDetailModal from './DecisionDetailModal';
import DocumentoDetailModal from './DocumentoDetailModal';
import { Search, ChevronDown, ChevronUp, ChevronsLeftRight, ChevronsRightLeft, Scale, DollarSign, FileText, Plus, CheckCircle2, Circle, Clock, Layers, MessageCircle } from 'lucide-react';
import { RenameService } from '../../services/rename.service';
import * as PDFCommentsService from '../../services/pdfComments.service';

interface GroupProgressStats {
  total: number;
  pendente: number;
  calculado: number;
  concluido: number;
}

const calculateGroupProgress = (items: { lancamento: VerbaLancamento }[]): GroupProgressStats => {
  const stats = { total: items.length, pendente: 0, calculado: 0, concluido: 0 };
  items.forEach(({ lancamento }) => {
    if (lancamento.checkCalculista && lancamento.checkRevisor) {
      stats.concluido++;
    } else if (lancamento.checkCalculista) {
      stats.calculado++;
    } else {
      stats.pendente++;
    }
  });
  return stats;
};

interface GroupProgressIndicatorProps {
  stats: GroupProgressStats;
}

const GroupProgressIndicator: React.FC<GroupProgressIndicatorProps> = ({ stats }) => {
  const { total, pendente, calculado, concluido } = stats;
  if (total === 0) return null;

  const isComplete = concluido === total;
  const isPartial = concluido > 0 || calculado > 0;

  return (
    <div className="flex items-center space-x-2">
      {isComplete ? (
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
          <CheckCircle2 size={12} className="flex-shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">{concluido}/{total}</span>
        </div>
      ) : isPartial ? (
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
          <Clock size={12} className="flex-shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">{concluido}/{total}</span>
        </div>
      ) : (
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
          <Circle size={12} className="flex-shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">{concluido}/{total}</span>
        </div>
      )}
    </div>
  );
};

interface PDFSidebarProps {
  processId: string;
}

const PDFSidebar: React.FC<PDFSidebarProps> = ({
  processId
}) => {
  const {
    decisions,
    addDecision,
    updateDecision,
    removeDecision
  } = useDecisions();

  const {
    verbas,
    addVerbaComLancamento,
    updateVerbaLancamento,
    removeVerbaLancamento,
    refreshVerbas
  } = useVerbas();

  const {
    documentos,
    addDocumento,
    updateDocumento,
    removeDocumento,
    renameTipoDocumento
  } = useDocumentos();

  const onSaveDecision = useCallback(async (decision: NewDecision, skipGlobalError?: boolean): Promise<OperationResult> => {
    return addDecision(decision, skipGlobalError);
  }, [addDecision]);

  const onUpdateDecision = useCallback(async (id: string, data: Partial<NewDecision>, skipGlobalError?: boolean): Promise<OperationResult> => {
    return updateDecision(id, data, skipGlobalError);
  }, [updateDecision]);

  const onDeleteDecision = useCallback(async (id: string, skipGlobalError?: boolean): Promise<OperationResult> => {
    return removeDecision(id, skipGlobalError);
  }, [removeDecision]);

  const onSaveVerba = useCallback(async (verba: NewVerbaComLancamento, skipGlobalError?: boolean): Promise<OperationResult> => {
    return addVerbaComLancamento(verba, skipGlobalError);
  }, [addVerbaComLancamento]);

  const onUpdateVerba = useCallback(async (verbaId: string, lancamentoId: string, data: any, skipGlobalError?: boolean): Promise<OperationResult> => {
    return updateVerbaLancamento(verbaId, lancamentoId, data, skipGlobalError);
  }, [updateVerbaLancamento]);

  const onDeleteVerba = useCallback(async (verbaId: string, lancamentoId: string, skipGlobalError?: boolean): Promise<OperationResult> => {
    return removeVerbaLancamento(verbaId, lancamentoId, skipGlobalError);
  }, [removeVerbaLancamento]);

  const onSaveDocumento = useCallback(async (documento: NewDocumento, skipGlobalError?: boolean): Promise<OperationResult> => {
    return addDocumento(documento, skipGlobalError);
  }, [addDocumento]);

  const onUpdateDocumento = useCallback(async (id: string, data: Partial<NewDocumento>, skipGlobalError?: boolean): Promise<OperationResult> => {
    return updateDocumento(id, data, skipGlobalError);
  }, [updateDocumento]);

  const onDeleteDocumento = useCallback(async (id: string, skipGlobalError?: boolean): Promise<OperationResult> => {
    return removeDocumento(id, skipGlobalError);
  }, [removeDocumento]);
  const {
    state,
    setSidebarTab,
    startCreateDecision,
    startCreateVerba,
    startCreateDocumento,
    startEditDecision,
    startEditVerba,
    startEditDocumento,
    cancelForm,
    removeHighlight,
    removeComment,
  } = usePDFViewer();

  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [groupByTipoVerba, setGroupByTipoVerba] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedLancamentoId, setSelectedLancamentoId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState<string | null>(null);
  const [isDocumentoModalOpen, setIsDocumentoModalOpen] = useState(false);
  const [decisionSearchQuery, setDecisionSearchQuery] = useState('');
  const [documentoSearchQuery, setDocumentoSearchQuery] = useState('');
  const [commentSearchQuery, setCommentSearchQuery] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search queries for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const debouncedDecisionSearchQuery = useDebounce(decisionSearchQuery, 300);
  const debouncedDocumentoSearchQuery = useDebounce(documentoSearchQuery, 300);
  const debouncedCommentSearchQuery = useDebounce(commentSearchQuery, 300);

  useEffect(() => {
    const savedGrouping = localStorage.getItem('pdf-sidebar-group-by-tipo');
    if (savedGrouping === 'true') {
      setGroupByTipoVerba(true);
    } else if (savedGrouping === 'false') {
      setGroupByTipoVerba(false);
    }
    const savedCollapsedGroups = localStorage.getItem('pdf-sidebar-collapsed-groups');
    if (savedCollapsedGroups) {
      try {
        const parsed = JSON.parse(savedCollapsedGroups);
        if (Array.isArray(parsed)) {
          setCollapsedGroups(new Set(parsed));
        }
      } catch {
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pdf-sidebar-group-by-tipo', groupByTipoVerba.toString());
  }, [groupByTipoVerba]);

  useEffect(() => {
    localStorage.setItem('pdf-sidebar-collapsed-groups', JSON.stringify(Array.from(collapsedGroups)));
  }, [collapsedGroups]);

  useEffect(() => {
    if (state.formMode === 'edit-verba' || state.formMode === 'create-verba' ||
        state.formMode === 'edit-decision' || state.formMode === 'create-decision' ||
        state.formMode === 'edit-documento' || state.formMode === 'create-documento') {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.formMode]);

  // Filter records for current process
  const processDecisions = useMemo(() => {
    return decisions
      .filter(d => d.processId === processId)
      .sort((a, b) => {
        // Sort by page (linked first, then by page number)
        if (a.paginaVinculada && !b.paginaVinculada) return -1;
        if (!a.paginaVinculada && b.paginaVinculada) return 1;
        if (a.paginaVinculada && b.paginaVinculada) {
          return a.paginaVinculada - b.paginaVinculada;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [decisions, processId]);

  const processVerbas = useMemo(() => {
    return verbas.filter(v => v.processId === processId);
  }, [verbas, processId]);

  // Flatten lancamentos with their parent verba
  const allLancamentos = useMemo(() => {
    const items = processVerbas.flatMap(verba =>
      verba.lancamentos.map(lancamento => ({ verba, lancamento }))
    );

    return items.sort((a, b) => {
      // Sort by page (linked first, then by page number)
      const pageA = a.lancamento.paginaVinculada;
      const pageB = b.lancamento.paginaVinculada;

      if (pageA && !pageB) return -1;
      if (!pageA && pageB) return 1;
      if (pageA && pageB) return pageA - pageB;

      return new Date(b.lancamento.createdAt).getTime() - new Date(a.lancamento.createdAt).getTime();
    });
  }, [processVerbas]);

  // Group by page
  const decisionsWithPage = useMemo(() =>
    processDecisions.filter(d => d.paginaVinculada),
    [processDecisions]
  );

  const decisionsWithoutPage = useMemo(() =>
    processDecisions.filter(d => !d.paginaVinculada),
    [processDecisions]
  );

  const lancamentosWithPage = useMemo(() =>
    allLancamentos.filter(l => l.lancamento.paginaVinculada),
    [allLancamentos]
  );

  const lancamentosWithoutPage = useMemo(() =>
    allLancamentos.filter(l => !l.lancamento.paginaVinculada),
    [allLancamentos]
  );

  const filteredLancamentos = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return allLancamentos;
    const query = debouncedSearchQuery.toLowerCase();
    return allLancamentos.filter(({ verba, lancamento }) => {
      return (
        verba.tipoVerba.toLowerCase().includes(query) ||
        lancamento.decisaoVinculada.toLowerCase().includes(query) ||
        lancamento.situacao.toLowerCase().includes(query)
      );
    });
  }, [allLancamentos, debouncedSearchQuery]);

  const groupedLancamentos = useMemo(() => {
    if (!groupByTipoVerba) return null;
    const groups = new Map<string, typeof allLancamentos>();
    filteredLancamentos.forEach((item) => {
      const tipo = item.verba.tipoVerba;
      if (!groups.has(tipo)) {
        groups.set(tipo, []);
      }
      groups.get(tipo)!.push(item);
    });

    const getFirstPage = (items: typeof allLancamentos): number | null => {
      const pages = items
        .map(({ lancamento }) => lancamento.paginaVinculada)
        .filter((page): page is number => page != null)
        .sort((x, y) => x - y);

      return pages.length > 0 ? pages[0] : null;
    };

    return Array.from(groups.entries()).sort((a, b) => {
      const firstPageA = getFirstPage(a[1]);
      const firstPageB = getFirstPage(b[1]);

      if (firstPageA != null && firstPageB != null) {
        if (firstPageA !== firstPageB) {
          return firstPageA - firstPageB;
        }
      } else if (firstPageA != null) {
        return -1;
      } else if (firstPageB != null) {
        return 1;
      }

      return a[0].localeCompare(b[0]);
    });
  }, [filteredLancamentos, groupByTipoVerba]);

  const lancamentosToDisplay = useMemo(() => {
    if (groupByTipoVerba) return [];
    return filteredLancamentos;
  }, [filteredLancamentos, groupByTipoVerba]);

  const displayLancamentosWithPage = useMemo(() => {
    return lancamentosToDisplay.filter(l => l.lancamento.paginaVinculada);
  }, [lancamentosToDisplay]);

  const displayLancamentosWithoutPage = useMemo(() => {
    return lancamentosToDisplay.filter(l => !l.lancamento.paginaVinculada);
  }, [lancamentosToDisplay]);

  const filteredDecisions = useMemo(() => {
    if (!debouncedDecisionSearchQuery.trim()) return processDecisions;
    const query = debouncedDecisionSearchQuery.toLowerCase();
    return processDecisions.filter(decision => {
      return (
        decision.tipoDecisao.toLowerCase().includes(query) ||
        decision.identificador?.toLowerCase().includes(query) ||
        decision.situacao.toLowerCase().includes(query)
      );
    });
  }, [processDecisions, debouncedDecisionSearchQuery]);

  const displayDecisionsWithPage = useMemo(() => {
    return filteredDecisions.filter(d => d.paginaVinculada);
  }, [filteredDecisions]);

  const displayDecisionsWithoutPage = useMemo(() => {
    return filteredDecisions.filter(d => !d.paginaVinculada);
  }, [filteredDecisions]);

  const processDocumentos = useMemo(() => {
    return documentos
      .filter(d => d.processId === processId)
      .sort((a, b) => {
        if (a.paginaVinculada && !b.paginaVinculada) return -1;
        if (!a.paginaVinculada && b.paginaVinculada) return 1;
        if (a.paginaVinculada && b.paginaVinculada) {
          return a.paginaVinculada - b.paginaVinculada;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [documentos, processId]);

  const filteredDocumentos = useMemo(() => {
    if (!debouncedDocumentoSearchQuery.trim()) return processDocumentos;
    const query = debouncedDocumentoSearchQuery.toLowerCase();
    return processDocumentos.filter(documento => {
      return (
        documento.tipoDocumento.toLowerCase().includes(query) ||
        documento.titulo?.toLowerCase().includes(query)
      );
    });
  }, [processDocumentos, debouncedDocumentoSearchQuery]);

  const displayDocumentosWithPage = useMemo(() => {
    return filteredDocumentos.filter(d => d.paginaVinculada);
  }, [filteredDocumentos]);

  const displayDocumentosWithoutPage = useMemo(() => {
    return filteredDocumentos.filter(d => !d.paginaVinculada);
  }, [filteredDocumentos]);

  const documentosWithPage = useMemo(() =>
    processDocumentos.filter(d => d.paginaVinculada),
    [processDocumentos]
  );

  const documentosWithoutPage = useMemo(() =>
    processDocumentos.filter(d => !d.paginaVinculada),
    [processDocumentos]
  );

  const sortedComments = useMemo(() => {
    return [...state.comments].sort((a, b) => a.pageNumber - b.pageNumber);
  }, [state.comments]);

  const filteredComments = useMemo(() => {
    if (!debouncedCommentSearchQuery.trim()) return sortedComments;
    const query = debouncedCommentSearchQuery.toLowerCase();
    return sortedComments.filter(c => c.content.toLowerCase().includes(query));
  }, [sortedComments, debouncedCommentSearchQuery]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await PDFCommentsService.deleteComment(commentId);
    } catch {
      toast.error('Falha ao excluir comentario.');
      return;
    }
    removeComment(commentId);
  }, [removeComment, toast]);

  const handleEditDecision = useCallback((decisionId: string) => {
    startEditDecision(decisionId);
  }, [startEditDecision]);

  const handleEditVerba = useCallback((lancamentoId: string) => {
    startEditVerba(lancamentoId);
  }, [startEditVerba]);

  const handleDeleteDecision = useCallback(async (decisionId: string) => {
    const result = await onDeleteDecision(decisionId, true);
    if (!result.success) {
      toast.error(result.error || 'Falha ao excluir decisao.');
    }
  }, [onDeleteDecision, toast]);

  const handleDeleteVerba = useCallback(async (verbaId: string, lancamentoId: string) => {
    const verba = verbas.find(v => v.id === verbaId);
    const lancamento = verba?.lancamentos.find(l => l.id === lancamentoId);

    const highlightIdsToRemove: string[] = [];
    if (lancamento?.highlightId) {
      highlightIdsToRemove.push(lancamento.highlightId);
    }
    if (lancamento?.highlightIds) {
      for (const hid of lancamento.highlightIds) {
        if (!highlightIdsToRemove.includes(hid)) {
          highlightIdsToRemove.push(hid);
        }
      }
    }

    try {
      const result = await onDeleteVerba(verbaId, lancamentoId, true);
      if (!result.success) {
        toast.error(result.error || 'Falha ao excluir lancamento.');
        return;
      }
      for (const hid of highlightIdsToRemove) {
        removeHighlight(hid);
      }
    } catch {
      toast.error('Erro ao excluir lancamento.');
    }
  }, [onDeleteVerba, toast, verbas, removeHighlight]);

  const handleToggleCheck = useCallback(async (
    verbaId: string,
    lancamentoId: string,
    field: 'calculista' | 'revisor',
    value: boolean
  ) => {
    try {
      const updateData = field === 'calculista'
        ? { checkCalculista: value, checkCalculistaAt: value ? new Date() : undefined }
        : { checkRevisor: value, checkRevisorAt: value ? new Date() : undefined };

      const result = await onUpdateVerba(verbaId, lancamentoId, updateData, true);
      if (!result.success) {
        toast.error(result.error || 'Falha ao atualizar status.');
      }
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  }, [onUpdateVerba, toast]);

  const handleViewDetails = useCallback((lancamentoId: string) => {
    setSelectedLancamentoId(lancamentoId);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedLancamentoId(null);
  }, []);

  const handleNavigateModal = (direction: 'previous' | 'next') => {
    if (!selectedLancamentoId) return;
    const currentIndex = filteredLancamentos.findIndex(l => l.lancamento.id === selectedLancamentoId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < filteredLancamentos.length) {
      setSelectedLancamentoId(filteredLancamentos[newIndex].lancamento.id);
    }
  };

  const toggleGroup = (tipoVerba: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tipoVerba)) {
        newSet.delete(tipoVerba);
      } else {
        newSet.add(tipoVerba);
      }
      return newSet;
    });
  };

  const allTipoVerbas = useMemo(() => {
    if (!groupedLancamentos) return [];
    return groupedLancamentos.map(([tipo]) => tipo);
  }, [groupedLancamentos]);

  const allGroupsExpanded = useMemo(() => {
    return collapsedGroups.size === 0;
  }, [collapsedGroups]);

  const allGroupsCollapsed = useMemo(() => {
    if (allTipoVerbas.length === 0) return true;
    return allTipoVerbas.every(tipo => collapsedGroups.has(tipo));
  }, [allTipoVerbas, collapsedGroups]);

  const expandAllGroups = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  const collapseAllGroups = useCallback(() => {
    setCollapsedGroups(new Set(allTipoVerbas));
  }, [allTipoVerbas]);

  const selectedLancamentoData = useMemo(() => {
    if (!selectedLancamentoId) return null;
    return filteredLancamentos.find(l => l.lancamento.id === selectedLancamentoId) || null;
  }, [selectedLancamentoId, filteredLancamentos]);

  const currentLancamentoIndex = useMemo(() => {
    if (!selectedLancamentoId) return -1;
    return filteredLancamentos.findIndex(l => l.lancamento.id === selectedLancamentoId);
  }, [selectedLancamentoId, filteredLancamentos]);

  const handleViewDecisionDetails = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDecisionModalOpen(true);
  };

  const handleCloseDecisionModal = () => {
    setIsDecisionModalOpen(false);
    setSelectedDecisionId(null);
  };

  const handleNavigateDecisionModal = (direction: 'previous' | 'next') => {
    if (!selectedDecisionId) return;
    const currentIndex = filteredDecisions.findIndex(d => d.id === selectedDecisionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < filteredDecisions.length) {
      setSelectedDecisionId(filteredDecisions[newIndex].id);
    }
  };

  const selectedDecisionData = useMemo(() => {
    if (!selectedDecisionId) return null;
    return filteredDecisions.find(d => d.id === selectedDecisionId) || null;
  }, [selectedDecisionId, filteredDecisions]);

  const currentDecisionIndex = useMemo(() => {
    if (!selectedDecisionId) return -1;
    return filteredDecisions.findIndex(d => d.id === selectedDecisionId);
  }, [selectedDecisionId, filteredDecisions]);

  const handleViewDocumentoDetails = (documentoId: string) => {
    setSelectedDocumentoId(documentoId);
    setIsDocumentoModalOpen(true);
  };

  const handleCloseDocumentoModal = () => {
    setIsDocumentoModalOpen(false);
    setSelectedDocumentoId(null);
  };

  const handleNavigateDocumentoModal = (direction: 'previous' | 'next') => {
    if (!selectedDocumentoId) return;
    const currentIndex = filteredDocumentos.findIndex(d => d.id === selectedDocumentoId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < filteredDocumentos.length) {
      setSelectedDocumentoId(filteredDocumentos[newIndex].id);
    }
  };

  const selectedDocumentoData = useMemo(() => {
    if (!selectedDocumentoId) return null;
    return filteredDocumentos.find(d => d.id === selectedDocumentoId) || null;
  }, [selectedDocumentoId, filteredDocumentos]);

  const currentDocumentoIndex = useMemo(() => {
    if (!selectedDocumentoId) return -1;
    return filteredDocumentos.findIndex(d => d.id === selectedDocumentoId);
  }, [selectedDocumentoId, filteredDocumentos]);

  const handleEditDocumento = (documentoId: string) => {
    startEditDocumento(documentoId);
  };

  const handleDeleteDocumento = async (documentoId: string): Promise<boolean> => {
    const result = await onDeleteDocumento(documentoId, true);
    if (result.success) {
      toast.success('Documento excluído com sucesso.');
    } else {
      toast.error(result.error || 'Falha ao excluir documento.');
    }
    return result.success;
  };

  const handleSaveDecisionForm = async (decision: NewDecision): Promise<boolean> => {
    const isEdit = state.formMode === 'edit-decision';

    if (isEdit && state.editingRecordId) {
      const result = await onUpdateDecision(state.editingRecordId, decision, true);
      if (result.success) {
        cancelForm();
      } else {
        toast.error(result.error || 'Falha ao atualizar decisao.');
      }
      return result.success;
    } else {
      const result = await onSaveDecision(decision, true);
      if (result.success) {
        cancelForm();
      } else {
        toast.error(result.error || 'Falha ao salvar decisao.');
      }
      return result.success;
    }
  };

  const handleSaveVerbaForm = async (verba: NewVerbaComLancamento): Promise<boolean> => {
    const isEdit = state.formMode === 'edit-verba';

    if (isEdit && state.editingRecordId) {
      const item = allLancamentos.find(l => l.lancamento.id === state.editingRecordId);
      if (item) {
        const oldTipo = item.verba.tipoVerba;
        const newTipo = verba.tipoVerba;
        let renamed = false;
        if (newTipo && newTipo.trim() && newTipo.trim() !== oldTipo) {
          const renameResult = await RenameService.renomearComAnalise(oldTipo, newTipo.trim(), processId);
          if (!renameResult.success) {
            toast.error(renameResult.message || 'Falha ao renomear tipo de verba.');
            return false;
          }
          renamed = true;
        }
        const result = await onUpdateVerba(item.verba.id, state.editingRecordId, verba.lancamento, true);
        if (result.success) {
          if (renamed) {
            await refreshVerbas();
          }
          cancelForm();
        } else {
          toast.error(result.error || 'Falha ao atualizar verba.');
        }
        return result.success;
      }
      toast.error('Lancamento nao encontrado para edicao.');
      return false;
    } else {
      const result = await onSaveVerba(verba, true);
      if (result.success) {
        cancelForm();
      } else {
        toast.error(result.error || 'Falha ao salvar verba.');
      }
      return result.success;
    }
  };

  const editingDecision = useMemo(() => {
    if (state.formMode === 'edit-decision' && state.editingRecordId) {
      return processDecisions.find(d => d.id === state.editingRecordId) || null;
    }
    return null;
  }, [state.formMode, state.editingRecordId, processDecisions]);

  const editingVerbaLancamento = useMemo(() => {
    if (state.formMode === 'edit-verba' && state.editingRecordId) {
      return allLancamentos.find(l => l.lancamento.id === state.editingRecordId) || null;
    }
    return null;
  }, [state.formMode, state.editingRecordId, allLancamentos]);

  const editingDocumento = useMemo(() => {
    if (state.formMode === 'edit-documento' && state.editingRecordId) {
      return processDocumentos.find(d => d.id === state.editingRecordId) || null;
    }
    return null;
  }, [state.formMode, state.editingRecordId, processDocumentos]);

  const handleRenameTipoDocumento = useCallback(async (oldTipo: string, newTipo: string): Promise<boolean> => {
    const result = await renameTipoDocumento(oldTipo, newTipo, true);
    if (result.success) {
      toast.success(`Tipo "${oldTipo}" renomeado para "${newTipo}".`);
    } else {
      toast.error(result.error || 'Falha ao renomear tipo de documento.');
    }
    return result.success;
  }, [renameTipoDocumento, toast]);

  const handleSaveDocumentoForm = async (documento: NewDocumento): Promise<boolean> => {
    const isEdit = state.formMode === 'edit-documento';

    if (isEdit && state.editingRecordId) {
      const result = await onUpdateDocumento(state.editingRecordId, documento, true);
      if (result.success) {
        toast.success('Documento atualizado com sucesso.');
        cancelForm();
      } else {
        toast.error(result.error || 'Falha ao atualizar documento.');
      }
      return result.success;
    } else {
      const result = await onSaveDocumento(documento, true);
      if (result.success) {
        toast.success('Documento salvo com sucesso.');
        cancelForm();
      } else {
        toast.error(result.error || 'Falha ao salvar documento.');
      }
      return result.success;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 notranslate" translate="no">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setSidebarTab('decisions')}
          className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
            state.sidebarTab === 'decisions'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
          aria-label="Aba de Decisões Judiciais"
        >
          <div className="flex items-center justify-center gap-1.5">
            <Scale size={15} />
            {state.sidebarTab === 'decisions' && <span>Decisões</span>}
            <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {processDecisions.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setSidebarTab('verbas')}
          className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
            state.sidebarTab === 'verbas'
              ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
          aria-label="Aba de Verbas"
        >
          <div className="flex items-center justify-center gap-1.5">
            <DollarSign size={15} />
            {state.sidebarTab === 'verbas' && <span>Verbas</span>}
            <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {allLancamentos.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setSidebarTab('documentos')}
          className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
            state.sidebarTab === 'documentos'
              ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
          aria-label="Aba de Documentos"
        >
          <div className="flex items-center justify-center gap-1.5">
            <FileText size={15} />
            {state.sidebarTab === 'documentos' && <span>Documentos</span>}
            <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {processDocumentos.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setSidebarTab('comments')}
          className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
            state.sidebarTab === 'comments'
              ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
          aria-label="Aba de Comentarios"
        >
          <div className="flex items-center justify-center gap-1.5">
            <MessageCircle size={15} />
            {state.sidebarTab === 'comments' && <span>Notas</span>}
            <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {state.comments.length}
            </span>
          </div>
        </button>
      </div>

      {/* Content Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        {/* Decisions Tab */}
        {state.sidebarTab === 'decisions' && (
          <div>
            {/* Controls Bar */}
            {state.formMode === 'view' && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Buscar decisoes..."
                      value={decisionSearchQuery}
                      onChange={(e) => setDecisionSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={startCreateDecision}
                    className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                    title="Nova Decisão"
                  >
                    <Scale size={12} />
                    <span>Decisão</span>
                  </button>
                </div>
                {decisionSearchQuery && (
                  <div className="text-xs text-gray-500">
                    {filteredDecisions.length} resultado(s) encontrado(s)
                  </div>
                )}
              </div>
            )}

            {/* Create/Edit Form */}
            {(state.formMode === 'create-decision' || state.formMode === 'edit-decision') && (
              <PDFDecisionFormInline
                processId={processId}
                onSave={handleSaveDecisionForm}
                onCancel={cancelForm}
                onDelete={state.formMode === 'edit-decision' ? async (id) => { await handleDeleteDecision(id); cancelForm(); return true; } : undefined}
                editingDecision={editingDecision}
              />
            )}

            {/* Decisions with Page */}
            {displayDecisionsWithPage.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1.5">
                  Vinculadas a Páginas
                </h4>
                <div className="space-y-2">
                  {displayDecisionsWithPage.map(decision => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      onEdit={handleEditDecision}
                      onDelete={handleDeleteDecision}
                      onViewDetails={handleViewDecisionDetails}
                      isHighlighted={state.highlightedPage === decision.paginaVinculada}
                                          />
                  ))}
                </div>
              </div>
            )}

            {/* Decisions without Page */}
            {displayDecisionsWithoutPage.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1.5">
                  Sem Página Vinculada
                </h4>
                <div className="space-y-2">
                  {displayDecisionsWithoutPage.map(decision => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      onEdit={handleEditDecision}
                      onDelete={handleDeleteDecision}
                      onViewDetails={handleViewDecisionDetails}
                                          />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {processDecisions.length === 0 && state.formMode === 'view' && (
              <div className="text-center py-12">
                <Scale className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-4">
                  Nenhuma decisão cadastrada
                </p>
                <button
                  onClick={startCreateDecision}
                  className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Scale size={16} />
                  <span>Criar primeira decisão</span>
                </button>
              </div>
            )}

            {/* No Results */}
            {decisionSearchQuery && filteredDecisions.length === 0 && processDecisions.length > 0 && (
              <div className="text-center py-12">
                <Search className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-2">
                  Nenhum resultado encontrado
                </p>
                <button
                  onClick={() => setDecisionSearchQuery('')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Limpar busca
                </button>
              </div>
            )}

            {/* Detail Modal */}
            {selectedDecisionData && (
              <DecisionDetailModal
                decision={selectedDecisionData}
                isOpen={isDecisionModalOpen}
                onClose={handleCloseDecisionModal}
                onEdit={handleEditDecision}
                onDelete={handleDeleteDecision}
                onNavigatePrevious={() => handleNavigateDecisionModal('previous')}
                onNavigateNext={() => handleNavigateDecisionModal('next')}
                hasPrevious={currentDecisionIndex > 0}
                hasNext={currentDecisionIndex < filteredDecisions.length - 1}
              />
            )}
          </div>
        )}

        {/* Verbas Tab */}
        {state.sidebarTab === 'verbas' && (
          <div>
            {/* Controls Bar */}
            {state.formMode === 'view' && (
              <div className="mb-4 space-y-2">
                {/* Search with Grouping */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Buscar verbas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={startCreateVerba}
                    className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-green-50 border border-green-300 text-green-700 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                    title="Nova Verba"
                  >
                    <Layers size={12} />
                    <span>Verba</span>
                  </button>
                  <button
                    onClick={() => setGroupByTipoVerba(!groupByTipoVerba)}
                    className={`p-1.5 rounded-lg border transition-all flex-shrink-0 ${
                      groupByTipoVerba
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Agrupar por Tipo de Verba"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  </button>
                  {groupByTipoVerba && allTipoVerbas.length > 0 && (
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      <button
                        onClick={expandAllGroups}
                        disabled={allGroupsExpanded}
                        className={`p-1.5 transition-colors ${
                          allGroupsExpanded
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title="Expandir Todos"
                      >
                        <ChevronsLeftRight size={12} />
                      </button>
                      <div className="w-px h-4 bg-gray-200" />
                      <button
                        onClick={collapseAllGroups}
                        disabled={allGroupsCollapsed}
                        className={`p-1.5 transition-colors ${
                          allGroupsCollapsed
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title="Recolher Todos"
                      >
                        <ChevronsRightLeft size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Results count */}
                {searchQuery && (
                  <div className="text-xs text-gray-500">
                    {filteredLancamentos.length} resultado(s)
                  </div>
                )}
              </div>
            )}

            {/* Create/Edit Form */}
            {(state.formMode === 'create-verba' || state.formMode === 'edit-verba') && (
              <PDFVerbaFormInline
                processId={processId}
                decisions={decisions}
                onSave={handleSaveVerbaForm}
                onCancel={cancelForm}
                onDelete={state.formMode === 'edit-verba' ? async (verbaId, lancamentoId) => { await handleDeleteVerba(verbaId, lancamentoId); cancelForm(); return true; } : undefined}
                editingVerba={editingVerbaLancamento}
              />
            )}

            {/* Grouped View */}
            {groupByTipoVerba && groupedLancamentos && groupedLancamentos.length > 0 && (
              <div className="space-y-3">
                {groupedLancamentos.map(([tipoVerba, items]) => {
                  const isCollapsed = collapsedGroups.has(tipoVerba);
                  const groupStats = calculateGroupProgress(items);
                  const isGroupComplete = groupStats.concluido === groupStats.total;
                  return (
                    <div
                      key={tipoVerba}
                      className={`border rounded-lg overflow-hidden transition-colors ${
                        isGroupComplete
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-gray-200'
                      }`}
                    >
                      <button
                        onClick={() => toggleGroup(tipoVerba)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          isGroupComplete
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center space-x-2 mb-1">
                              {isGroupComplete && (
                                <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                              )}
                              <span className={`text-sm font-semibold leading-snug ${
                                isGroupComplete ? 'text-green-800' : 'text-gray-900'
                              }`}>
                                {tipoVerba}
                              </span>
                            </div>
                            {isCollapsed && (
                              <div className="flex items-center space-x-2 mt-1.5">
                                <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                                </span>
                                <GroupProgressIndicator stats={groupStats} />
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0 mt-0.5">
                            {isCollapsed ? (
                              <ChevronDown size={16} className="text-gray-500" />
                            ) : (
                              <ChevronUp size={16} className="text-gray-500" />
                            )}
                          </div>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="p-3 space-y-2 bg-white">
                          {items.map(({ verba, lancamento }) => (
                            <VerbaLancamentoCard
                              key={lancamento.id}
                              verba={verba}
                              lancamento={lancamento}
                              onEdit={handleEditVerba}
                              onDelete={handleDeleteVerba}
                              onViewDetails={handleViewDetails}
                              onToggleCheck={handleToggleCheck}
                              isHighlighted={state.highlightedPage === lancamento.paginaVinculada}
                                                          />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ungrouped View */}
            {!groupByTipoVerba && (
              <>
                {/* Lancamentos with Page */}
                {displayLancamentosWithPage.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1.5">
                      Vinculadas a Páginas
                    </h4>
                    <div className="space-y-2">
                      {displayLancamentosWithPage.map(({ verba, lancamento }) => (
                        <VerbaLancamentoCard
                          key={lancamento.id}
                          verba={verba}
                          lancamento={lancamento}
                          onEdit={handleEditVerba}
                          onDelete={handleDeleteVerba}
                          onViewDetails={handleViewDetails}
                          onToggleCheck={handleToggleCheck}
                          isHighlighted={state.highlightedPage === lancamento.paginaVinculada}
                                                  />
                      ))}
                    </div>
                  </div>
                )}

                {/* Lancamentos without Page */}
                {displayLancamentosWithoutPage.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1.5">
                      Sem Página Vinculada
                    </h4>
                    <div className="space-y-2">
                      {displayLancamentosWithoutPage.map(({ verba, lancamento }) => (
                        <VerbaLancamentoCard
                          key={lancamento.id}
                          verba={verba}
                          lancamento={lancamento}
                          onEdit={handleEditVerba}
                          onDelete={handleDeleteVerba}
                          onViewDetails={handleViewDetails}
                          onToggleCheck={handleToggleCheck}
                                                  />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {allLancamentos.length === 0 && state.formMode === 'view' && (
              <div className="text-center py-12">
                <DollarSign className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-4">
                  Nenhuma verba cadastrada
                </p>
                <button
                  onClick={startCreateVerba}
                  className="inline-flex items-center space-x-2 text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  <DollarSign size={16} />
                  <span>Criar primeira verba</span>
                </button>
              </div>
            )}

            {/* No Results */}
            {searchQuery && filteredLancamentos.length === 0 && allLancamentos.length > 0 && (
              <div className="text-center py-12">
                <Search className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-2">
                  Nenhum resultado encontrado
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Limpar busca
                </button>
              </div>
            )}

            {/* Detail Modal */}
            {selectedLancamentoData && (
              <VerbaDetailModal
                verba={selectedLancamentoData.verba}
                lancamento={selectedLancamentoData.lancamento}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onEdit={handleEditVerba}
                onDelete={handleDeleteVerba}
                onNavigatePrevious={() => handleNavigateModal('previous')}
                onNavigateNext={() => handleNavigateModal('next')}
                hasPrevious={currentLancamentoIndex > 0}
                hasNext={currentLancamentoIndex < filteredLancamentos.length - 1}
              />
            )}
          </div>
        )}

        {/* Documentos Tab */}
        {state.sidebarTab === 'documentos' && (
          <div>
            {/* Controls Bar */}
            {state.formMode === 'view' && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Buscar documentos..."
                      value={documentoSearchQuery}
                      onChange={(e) => setDocumentoSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={startCreateDocumento}
                    className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-orange-50 border border-orange-300 text-orange-600 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                    title="Novo Documento"
                  >
                    <FileText size={12} />
                    <span>Documento</span>
                  </button>
                </div>
                {documentoSearchQuery && (
                  <div className="text-xs text-gray-500">
                    {filteredDocumentos.length} resultado(s) encontrado(s)
                  </div>
                )}
              </div>
            )}

            {/* Create/Edit Form */}
            {(state.formMode === 'create-documento' || state.formMode === 'edit-documento') && (
              <PDFDocumentoFormInline
                processId={processId}
                onSave={handleSaveDocumentoForm}
                onCancel={cancelForm}
                onDelete={state.formMode === 'edit-documento' ? async (id) => { const ok = await handleDeleteDocumento(id); if (ok) cancelForm(); return ok; } : undefined}
                onRenameTipo={handleRenameTipoDocumento}
                editingDocumento={editingDocumento}
              />
            )}

            {/* Documentos with Page */}
            {displayDocumentosWithPage.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1.5">
                  Vinculados a Páginas
                </h4>
                <div className="space-y-2">
                  {displayDocumentosWithPage.map(documento => (
                    <DocumentoCard
                      key={documento.id}
                      documento={documento}
                      onEdit={handleEditDocumento}
                      onDelete={handleDeleteDocumento}
                      onViewDetails={handleViewDocumentoDetails}
                      isHighlighted={state.highlightedPage === documento.paginaVinculada}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Documentos without Page */}
            {displayDocumentosWithoutPage.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1.5">
                  Sem Página Vinculada
                </h4>
                <div className="space-y-2">
                  {displayDocumentosWithoutPage.map(documento => (
                    <DocumentoCard
                      key={documento.id}
                      documento={documento}
                      onEdit={handleEditDocumento}
                      onDelete={handleDeleteDocumento}
                      onViewDetails={handleViewDocumentoDetails}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {processDocumentos.length === 0 && state.formMode === 'view' && (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-4">
                  Nenhum documento cadastrado
                </p>
                <button
                  onClick={startCreateDocumento}
                  className="inline-flex items-center space-x-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  <FileText size={16} />
                  <span>Criar primeiro documento</span>
                </button>
              </div>
            )}

            {/* No Results */}
            {documentoSearchQuery && filteredDocumentos.length === 0 && processDocumentos.length > 0 && (
              <div className="text-center py-12">
                <Search className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-2">
                  Nenhum resultado encontrado
                </p>
                <button
                  onClick={() => setDocumentoSearchQuery('')}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Limpar busca
                </button>
              </div>
            )}

            {/* Detail Modal */}
            {selectedDocumentoData && (
              <DocumentoDetailModal
                documento={selectedDocumentoData}
                isOpen={isDocumentoModalOpen}
                onClose={handleCloseDocumentoModal}
                onEdit={handleEditDocumento}
                onDelete={handleDeleteDocumento}
                onNavigatePrevious={() => handleNavigateDocumentoModal('previous')}
                onNavigateNext={() => handleNavigateDocumentoModal('next')}
                hasPrevious={currentDocumentoIndex > 0}
                hasNext={currentDocumentoIndex < filteredDocumentos.length - 1}
              />
            )}
          </div>
        )}

        {/* Comments Tab */}
        {state.sidebarTab === 'comments' && (
          <div>
            {/* Search Bar */}
            <div className="mb-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar comentarios..."
                  value={commentSearchQuery}
                  onChange={(e) => setCommentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              {commentSearchQuery && (
                <div className="text-xs text-gray-500">
                  {filteredComments.length} resultado(s) encontrado(s)
                </div>
              )}
            </div>

            {/* Comment List */}
            {filteredComments.length > 0 && (
              <div className="space-y-2">
                {filteredComments.map(comment => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onDelete={handleDeleteComment}
                    isHighlighted={state.selectedCommentId === comment.id}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {state.comments.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-2">
                  Nenhum comentario adicionado
                </p>
                <p className="text-xs text-gray-400">
                  Ative o modo de anotacao no visualizador para adicionar comentarios ao PDF
                </p>
              </div>
            )}

            {/* No Results */}
            {commentSearchQuery && filteredComments.length === 0 && state.comments.length > 0 && (
              <div className="text-center py-12">
                <Search className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-sm text-gray-600 mb-2">
                  Nenhum resultado encontrado
                </p>
                <button
                  onClick={() => setCommentSearchQuery('')}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Limpar busca
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default React.memo(PDFSidebar);
