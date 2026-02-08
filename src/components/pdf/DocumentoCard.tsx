import React, { useMemo } from 'react';
import { Documento } from '../../types/Documento';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { FileText, Eye, Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import { Tooltip } from '../ui';

interface DocumentoCardProps {
  documento: Documento;
  onEdit: (documentoId: string) => void;
  onDelete: (documentoId: string) => void;
  onViewDetails?: (documentoId: string) => void;
  isHighlighted?: boolean;
}

const DocumentoCard: React.FC<DocumentoCardProps> = ({
  documento,
  onEdit,
  onDelete,
  onViewDetails,
  isHighlighted = false
}) => {
  const { navigateToPageWithHighlight, scrollToMultipleHighlights, state } = usePDFViewer();

  const highlightIds = useMemo(() => {
    const storedIds = documento.highlightIds || [];
    const currentHighlightIds = new Set(state.highlights.map(h => h.id));
    return storedIds.filter(id => currentHighlightIds.has(id));
  }, [documento.highlightIds, state.highlights]);
  const hasHighlights = highlightIds.length > 0;

  const handleNavigateToPage = () => {
    if (hasHighlights && documento.paginaVinculada) {
      scrollToMultipleHighlights(highlightIds, documento.paginaVinculada);
    } else if (documento.paginaVinculada) {
      navigateToPageWithHighlight(documento.paginaVinculada, documento.id);
    }
  };

  const handleDelete = () => {
    onDelete(documento.id);
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

  const formatDate = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const hasComments = documento.comentarios && stripHtml(documento.comentarios).trim() !== '';
  const hasUpdate = documento.dataAtualizacao &&
    new Date(documento.dataAtualizacao).getTime() !== new Date(documento.dataCriacao).getTime();

  const tipoIsTruncated = documento.tipoDocumento && documento.tipoDocumento.length > 30;

  return (
    <div
      className={`
        group border rounded-lg transition-all duration-200 p-3
        ${isHighlighted ? 'border-orange-400 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {documento.paginaVinculada && (
              <button
                onClick={handleNavigateToPage}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-md transition-colors"
                title={hasHighlights ? `Ir para ${highlightIds.length} trecho(s) destacado(s) na pagina ${documento.paginaVinculada}` : `Ir para pagina ${documento.paginaVinculada}`}
              >
                <FileText size={11} />
                <span>p.{documento.paginaVinculada}</span>
              </button>
            )}
          </div>

          {tipoIsTruncated ? (
            <Tooltip content={documento.tipoDocumento}>
              <h4 className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">
                {documento.tipoDocumento}
              </h4>
            </Tooltip>
          ) : (
            <h4 className="font-semibold text-gray-900 text-sm">
              {documento.tipoDocumento}
            </h4>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(documento.id)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Ver detalhes"
            >
              <Eye size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(documento.id)}
            className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
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

      {hasComments && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mt-2 mb-2">
          {getPreviewText(documento.comentarios, 100)}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar size={11} />
          <span className="text-[10px]">{formatDate(documento.dataCriacao)}</span>
        </div>
        {hasUpdate && (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={11} />
            <span className="text-[10px]">{formatDate(documento.dataAtualizacao)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(DocumentoCard, (prevProps, nextProps) => {
  return (
    prevProps.documento.id === nextProps.documento.id &&
    new Date(prevProps.documento.dataAtualizacao).getTime() === new Date(nextProps.documento.dataAtualizacao).getTime() &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
});
