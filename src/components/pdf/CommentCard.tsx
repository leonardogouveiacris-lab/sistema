import React from 'react';
import { PDFComment, COMMENT_COLORS, CommentColor } from '../../types/PDFComment';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { FileText, MessageCircle, Calendar, Trash2, Eye } from 'lucide-react';
import { Tooltip } from '../ui';

function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function previewText(text: string | undefined, max = 90): string {
  if (!text) return '';
  const cleaned = text.trim().replace(/\[=\w+:[^:]+:([^\]]+)\]/g, '$1');
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

const COLOR_DOT: Record<CommentColor, string> = {
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
};

interface CommentCardProps {
  comment: PDFComment;
  onDelete?: (commentId: string) => void;
  onViewDetails?: (commentId: string) => void;
  isHighlighted?: boolean;
}

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onDelete,
  onViewDetails,
  isHighlighted = false,
}) => {
  const { navigateToPageWithHighlight, selectComment } = usePDFViewer();
  const colorStyles = COMMENT_COLORS[comment.color] || COMMENT_COLORS.yellow;

  const handleNavigate = () => {
    navigateToPageWithHighlight(comment.pageNumber);
    selectComment(comment.id);
  };

  const handleViewDetails = () => {
    navigateToPageWithHighlight(comment.pageNumber);
    selectComment(comment.id);
    onViewDetails?.(comment.id);
  };

  const preview = previewText(comment.content);
  const connectorCount = comment.connectors?.length || 0;

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
              <button
                onClick={handleNavigate}
                className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                title={`Ir para p.${comment.pageNumber}`}
              >
                <FileText size={9} />
                <span>p.{comment.pageNumber}</span>
              </button>

              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOT[comment.color] || 'bg-gray-400'}`}
                title={comment.color}
              />

              {connectorCount > 0 && (
                <span className="text-xs text-gray-400">
                  {connectorCount} conector{connectorCount > 1 ? 'es' : ''}
                </span>
              )}
            </div>

            {preview ? (
              <p className="text-sm text-gray-700 leading-snug line-clamp-2">
                {preview}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic leading-snug">
                Comentario sem texto
              </p>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={handleViewDetails}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Ver detalhes"
            >
              <Eye size={13} />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Excluir comentario"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={`flex items-center gap-2 px-3 pt-1.5 pb-1 text-xs text-gray-400 border-t ${
          isHighlighted ? 'border-blue-200 bg-blue-50/60' : 'border-gray-100 bg-gray-50'
        }`}
      >
        <Tooltip content={`Criado em: ${formatDateTime(comment.createdAt)}`}>
          <span className="cursor-default flex items-center gap-1">
            <Calendar size={10} className="flex-shrink-0" />
            {formatDateTime(comment.createdAt)}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default React.memo(CommentCard, (prev, next) => {
  return (
    prev.comment.id === next.comment.id &&
    prev.comment.updatedAt === next.comment.updatedAt &&
    prev.comment.content === next.comment.content &&
    prev.comment.color === next.comment.color &&
    prev.isHighlighted === next.isHighlighted
  );
});
