import React from 'react';
import { Decision } from '../../types/Decision';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { FileText, Eye, CreditCard as Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import { Tooltip } from '../ui';

function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface DecisionCardProps {
  decision: Decision;
  onEdit: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onViewDetails?: (decisionId: string) => void;
  isHighlighted?: boolean;
}

const SITUACAO_COLORS: Record<string, string> = {
  'Procedente': 'bg-green-100 text-green-800 border-green-300',
  'Improcedente': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Deferido': 'bg-blue-100 text-blue-800 border-blue-300',
  'Indeferido': 'bg-gray-100 text-gray-800 border-gray-300',
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

const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  onEdit,
  onDelete,
  onViewDetails,
  isHighlighted = false
}) => {
  const { navigateToPageWithHighlight } = usePDFViewer();

  const handleNavigate = () => {
    if (decision.paginaVinculada) {
      navigateToPageWithHighlight(decision.paginaVinculada, decision.id);
    }
  };

  const preview = previewText(decision.resumo || decision.observacoes);

  return (
    <div
      className={`group relative border rounded-lg transition-all duration-150 overflow-hidden ${
        isHighlighted
          ? 'border-blue-400 bg-blue-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {decision.paginaVinculada && (
                <button
                  onClick={handleNavigate}
                  className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                  title={`Ir para p.${decision.paginaVinculada}`}
                >
                  <FileText size={9} />
                  <span>p.{decision.paginaVinculada}</span>
                </button>
              )}
              <Tooltip content={decision.tipoDecisao}>
                <span className="text-xs text-gray-400 truncate max-w-[110px]">{decision.tipoDecisao}</span>
              </Tooltip>
            </div>

            <Tooltip content={decision.idDecisao}>
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {decision.idDecisao}
              </p>
            </Tooltip>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onViewDetails && (
              <button onClick={() => onViewDetails(decision.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Ver detalhes">
                <Eye size={13} />
              </button>
            )}
            <button onClick={() => onEdit(decision.id)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Editar">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(decision.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {decision.situacao && (
          <div className="mt-1.5">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${getSituacaoColor(decision.situacao)}`}>
              {decision.situacao}
            </span>
          </div>
        )}

        {preview && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-1.5">
            {preview}
          </p>
        )}
      </div>

      <div className={`flex items-center gap-2 px-3 pt-1.5 pb-1 text-xs text-gray-400 border-t ${isHighlighted ? 'border-blue-200 bg-blue-50/60' : 'border-gray-100 bg-gray-50'}`}>
        <Tooltip content={`Criado em: ${formatDateTime(decision.dataCriacao)}`}>
          <span className="cursor-default flex items-center gap-1">
            <Calendar size={10} className="flex-shrink-0" />
            {formatDateTime(decision.dataCriacao)}
          </span>
        </Tooltip>
        <Tooltip content={`Atualizado em: ${formatDateTime(decision.dataAtualizacao)}`}>
          <span className="cursor-default flex items-center gap-1">
            <Clock size={10} className="flex-shrink-0" />
            {formatDateTime(decision.dataAtualizacao)}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default React.memo(DecisionCard, (prev, next) => {
  return (
    prev.decision.id === next.decision.id &&
    new Date(prev.decision.dataAtualizacao).getTime() === new Date(next.decision.dataAtualizacao).getTime() &&
    prev.isHighlighted === next.isHighlighted
  );
});
