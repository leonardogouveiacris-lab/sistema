import React, { useMemo } from 'react';
import { Documento } from '../../types/Documento';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { FileText, Eye, CreditCard as Edit2, Trash2, Link2 } from 'lucide-react';
import { Tooltip } from '../ui';

interface DocumentoCardProps {
  documento: Documento;
  onEdit: (documentoId: string) => void;
  onDelete: (documentoId: string) => void;
  onViewDetails?: (documentoId: string) => void;
  isHighlighted?: boolean;
}

const TIPO_BADGE_COLORS: Record<string, string> = {
  'Petição Inicial': 'bg-blue-100 text-blue-800 border-blue-300',
  'Contestação': 'bg-red-100 text-red-800 border-red-300',
  'Réplica': 'bg-teal-100 text-teal-800 border-teal-300',
  'Laudo Pericial': 'bg-amber-100 text-amber-800 border-amber-300',
  'Recurso': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Contrato': 'bg-orange-100 text-orange-800 border-orange-300',
  'Sentença': 'bg-sky-100 text-sky-800 border-sky-300',
  'Acordo': 'bg-green-100 text-green-800 border-green-300',
};

function getTipoBadge(tipo: string): string {
  return TIPO_BADGE_COLORS[tipo] || 'bg-gray-100 text-gray-700 border-gray-300';
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

const DocumentoCard: React.FC<DocumentoCardProps> = ({
  documento,
  onEdit,
  onDelete,
  onViewDetails,
  isHighlighted = false
}) => {
  const { navigateToPageWithHighlight, scrollToMultipleHighlights, state } = usePDFViewer();

  const highlightIds = useMemo(() => {
    const stored = documento.highlightIds || [];
    const current = new Set(state.highlights.map(h => h.id));
    return stored.filter(id => current.has(id));
  }, [documento.highlightIds, state.highlights]);

  const hasHighlights = highlightIds.length > 0;

  const handleNavigate = () => {
    if (hasHighlights && documento.paginaVinculada) {
      scrollToMultipleHighlights(highlightIds, documento.paginaVinculada);
    } else if (documento.paginaVinculada) {
      navigateToPageWithHighlight(documento.paginaVinculada, documento.id);
    }
  };

  const preview = previewText(documento.comentarios);

  return (
    <div
      className={`group relative border rounded-lg transition-all duration-150 overflow-hidden ${
        isHighlighted
          ? 'border-orange-400 bg-orange-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {documento.paginaVinculada && (
                <button
                  onClick={handleNavigate}
                  className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded transition-colors"
                  title={hasHighlights ? `${highlightIds.length} trecho(s) na p.${documento.paginaVinculada}` : `Ir para p.${documento.paginaVinculada}`}
                >
                  {hasHighlights ? <Link2 size={9} /> : <FileText size={9} />}
                  <span>p.{documento.paginaVinculada}</span>
                </button>
              )}
            </div>

            <Tooltip content={documento.tipoDocumento}>
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {documento.tipoDocumento}
              </p>
            </Tooltip>

            <div className="mt-1">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${getTipoBadge(documento.tipoDocumento)}`}>
                {documento.tipoDocumento}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onViewDetails && (
              <button onClick={() => onViewDetails(documento.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Ver detalhes">
                <Eye size={13} />
              </button>
            )}
            <button onClick={() => onEdit(documento.id)} className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors" title="Editar">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(documento.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {preview && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-1.5">
            {preview}
          </p>
        )}

        {hasHighlights && (
          <div className="mt-1.5">
            <span className="text-xs text-blue-400 flex items-center gap-0.5">
              <Link2 size={9} />
              {highlightIds.length} destaque{highlightIds.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(DocumentoCard, (prev, next) => {
  return (
    prev.documento.id === next.documento.id &&
    new Date(prev.documento.dataAtualizacao).getTime() === new Date(next.documento.dataAtualizacao).getTime() &&
    prev.isHighlighted === next.isHighlighted
  );
});
