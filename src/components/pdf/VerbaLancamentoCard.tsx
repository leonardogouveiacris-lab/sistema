import React, { useState, useCallback, useMemo } from 'react';
import { Verba, VerbaLancamento } from '../../types/Verba';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useToast } from '../../contexts/ToastContext';
import { Link2, FileText, Eye, CreditCard as Edit2, Trash2, Circle, Clock, CheckCircle2, Check } from 'lucide-react';
import { Tooltip } from '../ui';

type StatusState = 'pendente' | 'calculado' | 'concluido';

const getStatusFromLancamento = (lancamento: VerbaLancamento): StatusState => {
  if (lancamento.checkCalculista && lancamento.checkRevisor) return 'concluido';
  if (lancamento.checkCalculista) return 'calculado';
  return 'pendente';
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

const SITUACAO_COLORS: Record<string, string> = {
  'Deferida': 'bg-green-100 text-green-800 border-green-300',
  'Indeferida': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Reformada': 'bg-sky-100 text-sky-800 border-sky-300',
  'Em Analise': 'bg-blue-100 text-blue-800 border-blue-300',
  'Excluida': 'bg-gray-100 text-gray-800 border-gray-300',
};

function getSituacaoColor(s: string): string {
  return SITUACAO_COLORS[s] || 'bg-gray-100 text-gray-700 border-gray-300';
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function previewText(html: string | undefined, max = 90): string {
  if (!html) return '';
  const t = stripHtml(html);
  return t.length > max ? `${t.slice(0, max)}…` : t;
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
    const stored = lancamento.highlightIds || (lancamento.highlightId ? [lancamento.highlightId] : []);
    const current = new Set(state.highlights.map(h => h.id));
    return stored.filter(id => current.has(id));
  }, [lancamento.highlightIds, lancamento.highlightId, state.highlights]);

  const hasHighlights = highlightIds.length > 0;
  const currentStatus = getStatusFromLancamento(lancamento);

  const handleNavigate = () => {
    if (hasHighlights && lancamento.paginaVinculada) {
      scrollToMultipleHighlights(highlightIds, lancamento.paginaVinculada);
    } else if (lancamento.paginaVinculada) {
      navigateToPageWithHighlight(lancamento.paginaVinculada, lancamento.id);
    }
  };

  const advanceStatus = useCallback(async () => {
    if (!onToggleCheck || isUpdating) return;
    setIsUpdating(true);
    try {
      if (currentStatus === 'pendente') await onToggleCheck(verba.id, lancamento.id, 'calculista', true);
      else if (currentStatus === 'calculado') await onToggleCheck(verba.id, lancamento.id, 'revisor', true);
    } catch { toast.error('Erro ao atualizar status.'); }
    finally { setIsUpdating(false); }
  }, [onToggleCheck, isUpdating, currentStatus, verba.id, lancamento.id, toast]);

  const regressStatus = useCallback(async () => {
    if (!onToggleCheck || isUpdating) return;
    setIsUpdating(true);
    try {
      if (currentStatus === 'concluido') await onToggleCheck(verba.id, lancamento.id, 'revisor', false);
      else if (currentStatus === 'calculado') await onToggleCheck(verba.id, lancamento.id, 'calculista', false);
    } catch { toast.error('Erro ao atualizar status.'); }
    finally { setIsUpdating(false); }
  }, [onToggleCheck, isUpdating, currentStatus, verba.id, lancamento.id, toast]);

  const preview = previewText(lancamento.fundamentacao || lancamento.comentariosCalculistas);

  return (
    <div
      className={`group relative border rounded-lg transition-all duration-150 overflow-hidden ${
        isHighlighted
          ? 'border-green-400 bg-green-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {lancamento.paginaVinculada && (
                <button
                  onClick={handleNavigate}
                  className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                  title={hasHighlights ? `${highlightIds.length} trecho(s) na p.${lancamento.paginaVinculada}` : `Ir para p.${lancamento.paginaVinculada}`}
                >
                  {hasHighlights ? <Link2 size={9} /> : <FileText size={9} />}
                  <span>p.{lancamento.paginaVinculada}</span>
                </button>
              )}
              <Tooltip content={verba.tipoVerba}>
                <span className="text-xs text-gray-400 truncate max-w-[100px]">{verba.tipoVerba}</span>
              </Tooltip>
            </div>

            <Tooltip content={lancamento.decisaoVinculada || ''}>
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {lancamento.decisaoVinculada || <span className="text-gray-400 font-normal italic text-xs">Sem decisão vinculada</span>}
              </p>
            </Tooltip>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onViewDetails && (
              <button onClick={() => onViewDetails(lancamento.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Ver detalhes">
                <Eye size={13} />
              </button>
            )}
            <button onClick={() => onEdit(lancamento.id)} className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors" title="Editar">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(verba.id, lancamento.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {lancamento.situacao && (
          <div className="mt-1.5">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${getSituacaoColor(lancamento.situacao)}`}>
              {lancamento.situacao}
            </span>
          </div>
        )}

        {preview && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-1.5">
            {preview}
          </p>
        )}
      </div>

      <div className={`flex items-center justify-between px-3 py-1.5 border-t ${isHighlighted ? 'border-green-200 bg-green-50/60' : 'border-gray-100 bg-gray-50'}`}>
        {onToggleCheck ? (
          <button
            onClick={currentStatus !== 'concluido' ? () => advanceStatus() : undefined}
            onContextMenu={e => { e.preventDefault(); if (currentStatus !== 'pendente') regressStatus(); }}
            disabled={isUpdating}
            title={
              currentStatus === 'pendente' ? 'Clique para marcar como Calculado'
              : currentStatus === 'calculado' ? 'Clique para Concluir · Direito para regredir'
              : 'Concluído · Direito para regredir'
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${
              currentStatus === 'concluido'
                ? 'bg-green-100 text-green-700 border-green-300 cursor-default'
                : currentStatus === 'calculado'
                ? 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 cursor-pointer'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 cursor-pointer'
            }`}
          >
            {currentStatus === 'concluido'
              ? <><CheckCircle2 size={10} className="text-green-600" /><span>Concluído</span><Check size={8} className="text-green-600 ml-0.5" /></>
              : currentStatus === 'calculado'
              ? <><Clock size={10} className="text-blue-500" /><span>Calculado</span></>
              : <><Circle size={10} className="text-gray-400" /><span>Pendente</span></>
            }
          </button>
        ) : <div />}

        {hasHighlights && (
          <span className="text-xs text-blue-400 flex items-center gap-0.5">
            <Link2 size={9} />
            {highlightIds.length}
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(VerbaLancamentoCard, (prev, next) => {
  return (
    prev.verba.id === next.verba.id &&
    prev.lancamento.id === next.lancamento.id &&
    new Date(prev.lancamento.dataAtualizacao).getTime() === new Date(next.lancamento.dataAtualizacao).getTime() &&
    prev.lancamento.checkCalculista === next.lancamento.checkCalculista &&
    prev.lancamento.checkRevisor === next.lancamento.checkRevisor &&
    prev.isHighlighted === next.isHighlighted
  );
});
