import React from 'react';
import { X, FileText, Calendar } from 'lucide-react';
import { PDFComment, COMMENT_COLORS, CommentColor } from '../../types/PDFComment';

const COLOR_DOT: Record<CommentColor, string> = {
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
};

function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hasContent(html: string | undefined): boolean {
  if (!html) return false;
  const stripped = html.replace(/<[^>]+>/g, '').trim();
  return stripped.length > 0;
}

interface CommentDetailModalProps {
  comment: PDFComment;
  onClose: () => void;
  onNavigate: (commentId: string) => void;
}

const CommentDetailModal: React.FC<CommentDetailModalProps> = ({ comment, onClose, onNavigate }) => {
  const colorConfig = COMMENT_COLORS[comment.color] || COMMENT_COLORS.yellow;
  const connectorCount = comment.connectors?.length || 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className={`px-5 py-4 ${colorConfig.bg} border-b ${colorConfig.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOT[comment.color] || 'bg-gray-400'}`} />
            <div>
              <p className="text-sm font-semibold text-gray-800">Nota</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar size={11} className="text-gray-500" />
                <span className="text-xs text-gray-500">{formatDateTime(comment.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => { onNavigate(comment.id); onClose(); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
            >
              <FileText size={11} />
              <span>Ir para p.{comment.pageNumber}</span>
            </button>
            {connectorCount > 0 && (
              <span className="text-xs text-gray-400">
                {connectorCount} conector{connectorCount > 1 ? 'es' : ''}
              </span>
            )}
          </div>

          <div className="min-h-[80px] max-h-80 overflow-y-auto">
            {hasContent(comment.content) ? (
              <div
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed text-justify"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
            ) : (
              <p className="text-sm text-gray-400 italic">Comentario sem texto</p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentDetailModal;
