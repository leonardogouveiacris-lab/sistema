import React, { useEffect, useCallback } from 'react';
import { Decision } from '../../types/Decision';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { X, ChevronLeft, ChevronRight, CreditCard as Edit2, Trash2, FileText, Scale, Calendar, Clock } from 'lucide-react';
import { LancamentoRefRenderer } from '../ui';
import { useLancamentosForReference, LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';

interface DecisionDetailModalProps {
  decision: Decision;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({
  decision,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onNavigatePrevious,
  onNavigateNext,
  hasPrevious = false,
  hasNext = false
}) => {
  const { navigateToPageWithHighlight, scrollToMultipleHighlights } = usePDFViewer();
  const referenceItems = useLancamentosForReference(decision.processId);

  const handleRefNavigate = useCallback((item: LancamentoReferenceItem) => {
    if (item.highlightIds?.length && item.paginaVinculada) {
      scrollToMultipleHighlights(item.highlightIds, item.paginaVinculada);
    } else if (item.paginaVinculada) {
      navigateToPageWithHighlight(item.paginaVinculada, item.id);
    }
    onClose();
  }, [navigateToPageWithHighlight, scrollToMultipleHighlights, onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleNavigateToPage = () => {
    if (decision.paginaVinculada) {
      navigateToPageWithHighlight(decision.paginaVinculada, decision.id);
      onClose();
    }
  };

  const getSafeDate = (dateValue?: string | Date | null): Date | null => {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDateTime = (dateValue?: string | Date | null): string => {
    const d = getSafeDate(dateValue);
    return d ? d.toLocaleString('pt-BR') : 'Data indisponível';
  };

  const createdAt = getSafeDate(decision.dataCriacao);
  const updatedAt = getSafeDate(decision.dataAtualizacao);
  const shouldShowUpdatedAt =
    createdAt !== null &&
    updatedAt !== null &&
    updatedAt.getTime() !== createdAt.getTime();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onClose}
      />

      <div className="absolute right-4 top-4 pointer-events-auto w-[480px] bg-white shadow-2xl flex flex-col border border-gray-200 rounded-xl max-h-[calc(100vh-2rem)] overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-blue-100 bg-blue-50 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                <Scale size={11} />
                {decision.tipoDecisao}
              </span>
              {decision.paginaVinculada && (
                <button
                  onClick={handleNavigateToPage}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors"
                  title={`Ir para página ${decision.paginaVinculada}`}
                >
                  <FileText size={11} />
                  Página {decision.paginaVinculada}
                </button>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">
              {decision.identificador || 'Decisão'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-blue-100 rounded-lg transition-colors"
            title="Fechar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {decision.resumo && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Resumo</p>
              <LancamentoRefRenderer
                html={decision.resumo}
                referenceItems={referenceItems}
                onNavigate={handleRefNavigate}
                className="text-[15px] text-gray-800 leading-relaxed bg-gray-50 px-4 py-3 rounded-lg border border-gray-200"
              />
            </div>
          )}

          {decision.observacoes && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Observações</p>
              <LancamentoRefRenderer
                html={decision.observacoes}
                referenceItems={referenceItems}
                onNavigate={handleRefNavigate}
                className="text-[15px] text-gray-800 leading-relaxed bg-gray-50 px-4 py-3 rounded-lg border border-gray-200"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 pt-1">
            <span className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar size={12} />
              <span className="font-medium text-gray-500">Criado em</span>
              {formatDateTime(decision.dataCriacao)}
            </span>
            {shouldShowUpdatedAt && (
              <span className="flex items-center gap-2 text-xs text-gray-400">
                <Clock size={12} />
                <span className="font-medium text-gray-500">Atualizado em</span>
                {formatDateTime(decision.dataAtualizacao)}
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onNavigatePrevious}
                disabled={!hasPrevious}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasPrevious
                    ? 'text-gray-700 bg-white hover:bg-gray-100 border border-gray-200'
                    : 'text-gray-300 bg-gray-50 border border-gray-100 cursor-not-allowed'
                }`}
                title="Anterior"
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <button
                onClick={onNavigateNext}
                disabled={!hasNext}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasNext
                    ? 'text-gray-700 bg-white hover:bg-gray-100 border border-gray-200'
                    : 'text-gray-300 bg-gray-50 border border-gray-100 cursor-not-allowed'
                }`}
                title="Próximo"
              >
                Próximo <ChevronRight size={15} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { onEdit(decision.id); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Edit2 size={14} /> Editar
              </button>
              <button
                onClick={() => { onDelete(decision.id); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DecisionDetailModal);
