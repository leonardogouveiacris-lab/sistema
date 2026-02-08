import React, { useState, useCallback, useMemo } from 'react';
import { Verba, VerbaLancamento } from '../../types/Verba';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useToast } from '../../contexts/ToastContext';
import { FileText, Eye, Edit2, Trash2, Link2, Circle, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { Tooltip } from '../ui';

type StatusState = 'pendente' | 'calculado' | 'concluido';

const getStatusFromLancamento = (lancamento: VerbaLancamento): StatusState => {
  if (lancamento.checkCalculista && lancamento.checkRevisor) return 'concluido';
  if (lancamento.checkCalculista) return 'calculado';
  return 'pendente';
};

const getStatusConfig = (status: StatusState) => {
  switch (status) {
    case 'pendente':
      return {
        icon: Circle,
        label: 'Pendente',
        bgClass: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
        iconClass: 'text-gray-500'
      };
    case 'calculado':
      return {
        icon: Clock,
        label: 'Calculado',
        bgClass: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
        iconClass: 'text-blue-600'
      };
    case 'concluido':
      return {
        icon: CheckCircle2,
        label: 'Concluido',
        bgClass: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
        iconClass: 'text-green-600'
      };
  }
};

interface VerbaLancamentoCardProps {
  verba: Verba;
  lancamento: VerbaLancamento;
  onEdit: (lancamentoId: string) => void;
  onDelete: (verbaId: string, lancamentoId: string) => void;
  onViewDetails?: (lancamentoId: string) => void;
  onToggleCheck?: (verbaId: string, lancamentoId: string, field: 'calculista' | 'revisor', value: boolean) => void;
  isHighlighted?: boolean;
}

const VerbaLancamentoCard: React.FC<VerbaLancamentoCardProps> = ({
  verba,
  lancamento,
  onEdit,
  onDelete,
  onViewDetails,
  onToggleCheck,
  isHighlighted = false
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { navigateToPageWithHighlight, scrollToMultipleHighlights, state } = usePDFViewer();
  const toast = useToast();

  const highlightIds = useMemo(() => {
    const storedIds = lancamento.highlightIds || (lancamento.highlightId ? [lancamento.highlightId] : []);
    const currentHighlightIds = new Set(state.highlights.map(h => h.id));
    return storedIds.filter(id => currentHighlightIds.has(id));
  }, [lancamento.highlightIds, lancamento.highlightId, state.highlights]);
  const hasHighlights = highlightIds.length > 0;

  const handleNavigateToPage = () => {
    if (hasHighlights && lancamento.paginaVinculada) {
      scrollToMultipleHighlights(highlightIds, lancamento.paginaVinculada);
    } else if (lancamento.paginaVinculada) {
      navigateToPageWithHighlight(lancamento.paginaVinculada, lancamento.id);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(verba.id, lancamento.id);
    } catch {
      toast.error('Erro ao excluir lancamento.');
    }
  };

  const currentStatus = getStatusFromLancamento(lancamento);
  const statusConfig = getStatusConfig(currentStatus);
  const StatusIcon = statusConfig.icon;

  const advanceStatus = useCallback(async () => {
    if (!onToggleCheck || isUpdating) return;
    setIsUpdating(true);
    try {
      if (currentStatus === 'pendente') {
        await onToggleCheck(verba.id, lancamento.id, 'calculista', true);
      } else if (currentStatus === 'calculado') {
        await onToggleCheck(verba.id, lancamento.id, 'revisor', true);
      }
    } catch {
      toast.error('Erro ao atualizar status.');
    } finally {
      setIsUpdating(false);
    }
  }, [onToggleCheck, isUpdating, currentStatus, verba.id, lancamento.id, toast]);

  const regressStatus = useCallback(async () => {
    if (!onToggleCheck || isUpdating) return;
    setIsUpdating(true);
    try {
      if (currentStatus === 'concluido') {
        await onToggleCheck(verba.id, lancamento.id, 'revisor', false);
      } else if (currentStatus === 'calculado') {
        await onToggleCheck(verba.id, lancamento.id, 'calculista', false);
      }
    } catch {
      toast.error('Erro ao atualizar status.');
    } finally {
      setIsUpdating(false);
    }
  }, [onToggleCheck, isUpdating, currentStatus, verba.id, lancamento.id, toast]);

  const handleStatusClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (currentStatus === 'concluido') return;
    advanceStatus();
  }, [currentStatus, advanceStatus]);

  const handleStatusContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (currentStatus === 'pendente') return;
    regressStatus();
  }, [currentStatus, regressStatus]);

  const getSituationColor = (situacao: string): string => {
    const colors: Record<string, string> = {
      'Deferida': 'bg-green-100 text-green-800 border-green-300',
      'Indeferida': 'bg-red-100 text-red-800 border-red-300',
      'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Reformada': 'bg-blue-100 text-blue-800 border-blue-300',
      'Excluida': 'bg-gray-100 text-gray-800 border-gray-300',
      'Em Analise': 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[situacao] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const stripHtml = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  const getPreviewText = (html: string | undefined, maxLength = 80): string => {
    if (!html) return '';
    const text = stripHtml(html);
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const hasUpdate = lancamento.dataAtualizacao &&
    new Date(lancamento.dataAtualizacao).getTime() !== new Date(lancamento.dataCriacao).getTime();

  return (
    <div
      className={`
        group border rounded-lg transition-all duration-200 p-3
        ${isHighlighted ? 'border-green-400 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
      `}
    >
      <div className="flex items-start justify-between gap-2 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5">
            {lancamento.paginaVinculada && (
              <button
                onClick={handleNavigateToPage}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                title={hasHighlights ? `Ir para ${highlightIds.length} trecho(s) destacado(s) na pagina ${lancamento.paginaVinculada}` : `Ir para pagina ${lancamento.paginaVinculada}`}
              >
                {hasHighlights ? <Link2 size={11} /> : <FileText size={11} />}
                <span>p.{lancamento.paginaVinculada}</span>
              </button>
            )}
            <Tooltip content={verba.tipoVerba}>
              <span className="text-xs text-gray-500 font-medium truncate">{verba.tipoVerba}</span>
            </Tooltip>
          </div>

          <Tooltip content={lancamento.decisaoVinculada || ''}>
            <h4 className="font-semibold text-gray-900 text-sm truncate">
              {lancamento.decisaoVinculada}
            </h4>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(lancamento.id)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Ver detalhes"
            >
              <Eye size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(lancamento.id)}
            className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
            title="Editar"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 mb-2 flex-wrap">
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${getSituationColor(lancamento.situacao)}`}>
          {lancamento.situacao}
        </span>

        {onToggleCheck && (
          <button
            onClick={handleStatusClick}
            onContextMenu={handleStatusContextMenu}
            disabled={isUpdating}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border transition-colors ${statusConfig.bgClass} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              currentStatus === 'pendente'
                ? 'Clique para marcar como Calculado'
                : currentStatus === 'calculado'
                  ? 'Clique para marcar como Concluido | Clique direito para voltar'
                  : 'Clique direito para voltar para Calculado'
            }
          >
            <StatusIcon size={11} className={statusConfig.iconClass} />
            <span>{statusConfig.label}</span>
          </button>
        )}
      </div>

      {(lancamento.fundamentacao || lancamento.comentariosCalculistas) && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">
          {getPreviewText(lancamento.fundamentacao || lancamento.comentariosCalculistas, 100)}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar size={11} />
          <span className="text-[10px]">{formatDate(lancamento.dataCriacao)}</span>
        </div>
        {hasUpdate && (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={11} />
            <span className="text-[10px]">{formatDate(lancamento.dataAtualizacao)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(VerbaLancamentoCard, (prevProps, nextProps) => {
  return (
    prevProps.verba.id === nextProps.verba.id &&
    prevProps.lancamento.id === nextProps.lancamento.id &&
    new Date(prevProps.lancamento.dataAtualizacao).getTime() === new Date(nextProps.lancamento.dataAtualizacao).getTime() &&
    prevProps.lancamento.checkCalculista === nextProps.lancamento.checkCalculista &&
    prevProps.lancamento.checkRevisor === nextProps.lancamento.checkRevisor &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
});
