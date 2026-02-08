import React from 'react';
import { Decision } from '../../types/Decision';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { FileText, Eye, Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import { Tooltip } from '../ui';

interface DecisionCardProps {
  decision: Decision;
  onEdit: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onViewDetails?: (decisionId: string) => void;
  isHighlighted?: boolean;
}

const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  onEdit,
  onDelete,
  onViewDetails,
  isHighlighted = false
}) => {
  const { navigateToPageWithHighlight } = usePDFViewer();

  const handleNavigateToPage = () => {
    if (decision.paginaVinculada) {
      navigateToPageWithHighlight(decision.paginaVinculada, decision.id);
    }
  };

  const handleDelete = () => {
    onDelete(decision.id);
  };

  const getSituationColor = (situacao: string): string => {
    const colors: Record<string, string> = {
      'Procedente': 'bg-green-100 text-green-800 border-green-300',
      'Improcedente': 'bg-red-100 text-red-800 border-red-300',
      'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Deferido': 'bg-blue-100 text-blue-800 border-blue-300',
      'Indeferido': 'bg-gray-100 text-gray-800 border-gray-300',
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

  const hasUpdate = decision.dataAtualizacao &&
    new Date(decision.dataAtualizacao).getTime() !== new Date(decision.dataCriacao).getTime();

  const titleIsTruncated = decision.idDecisao && decision.idDecisao.length > 30;
  const tipoIsTruncated = decision.tipoDecisao && decision.tipoDecisao.length > 20;

  return (
    <div
      className={`
        group border rounded-lg transition-all duration-200 p-3
        ${isHighlighted ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {decision.paginaVinculada && (
              <button
                onClick={handleNavigateToPage}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                title={`Ir para pagina ${decision.paginaVinculada}`}
              >
                <FileText size={11} />
                <span>p.{decision.paginaVinculada}</span>
              </button>
            )}
            {tipoIsTruncated ? (
              <Tooltip content={decision.tipoDecisao}>
                <span className="text-xs text-gray-500 truncate max-w-[100px]">{decision.tipoDecisao}</span>
              </Tooltip>
            ) : (
              <span className="text-xs text-gray-500">{decision.tipoDecisao}</span>
            )}
          </div>

          {titleIsTruncated ? (
            <Tooltip content={decision.idDecisao}>
              <h4 className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">
                {decision.idDecisao}
              </h4>
            </Tooltip>
          ) : (
            <h4 className="font-semibold text-gray-900 text-sm">
              {decision.idDecisao}
            </h4>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(decision.id)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Ver detalhes"
            >
              <Eye size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(decision.id)}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
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

      <div className="mt-2 mb-2">
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${getSituationColor(decision.situacao)}`}>
          {decision.situacao}
        </span>
      </div>

      {(decision.resumo || decision.observacoes) && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">
          {getPreviewText(decision.resumo || decision.observacoes, 100)}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar size={11} />
          <span className="text-[10px]">{formatDate(decision.dataCriacao)}</span>
        </div>
        {hasUpdate && (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={11} />
            <span className="text-[10px]">{formatDate(decision.dataAtualizacao)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(DecisionCard, (prevProps, nextProps) => {
  return (
    prevProps.decision.id === nextProps.decision.id &&
    new Date(prevProps.decision.dataAtualizacao).getTime() === new Date(nextProps.decision.dataAtualizacao).getTime() &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
});
