import React, { useMemo } from 'react';
import { Documento } from '../../types/Documento';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { FileText, Eye, CreditCard as Edit2, Trash2, Link2, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Tooltip } from '../ui';

function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface DocumentoCardProps {
  documento: Documento;
  onEdit: (documentoId: string) => void;
  onDelete: (documentoId: string) => void;
  onViewDetails?: (documentoId: string) => void;
  isHighlighted?: boolean;
  onToggleCheck?: (documentoId: string, field: 'calculista' | 'revisor', value: boolean) => void;
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
  isHighlighted = false,
  onToggleCheck
}) => {
  const { navigateToPageWithHighlight, scrollToMultipleHighlights, state } = usePDFViewer();
  const isConcluido = documento.checkCalculista && documento.checkRevisor;

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
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {isConcluido && (
              <Tooltip content="Concluído - não pode ser excluído">
                <span className="p-1.5 text-green-400 flex-shrink-0">
                  <CheckCircle2 size={13} />
                </span>
              </Tooltip>
            )}
            {onViewDetails && (
              <button onClick={() => onViewDetails(documento.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Ver detalhes">
                <Eye size={13} />
              </button>
            )}
            <button onClick={() => onEdit(documento.id)} className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors" title="Editar">
              <Edit2 size={13} />
            </button>
            {isConcluido ? (
              <span className="p-1.5 text-gray-300 cursor-not-allowed" title="Documento concluído não pode ser excluído">
                <Trash2 size={13} />
              </span>
            ) : (
              <button onClick={() => onDelete(documento.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {preview && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-1.5">
            {preview}
          </p>
        )}
      </div>

      <div className={`flex items-center gap-2 px-3 pt-1.5 pb-1 text-xs text-gray-400 border-t ${isHighlighted ? 'border-orange-200 bg-orange-50/60' : 'border-gray-100 bg-gray-50'}`}>
        {hasHighlights && (
          <span className="flex items-center gap-0.5 text-blue-400 mr-1">
            <Link2 size={9} />
            {highlightIds.length}
          </span>
        )}
        {onToggleCheck && (
          <div className="flex items-center gap-1 mr-1">
            <Tooltip content={documento.checkCalculista ? 'Calculista verificado - clique para desmarcar' : 'Marcar calculista'}>
              <button
                onClick={e => { e.stopPropagation(); onToggleCheck(documento.id, 'calculista', !documento.checkCalculista); }}
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${documento.checkCalculista ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
              >
                {documento.checkCalculista && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
              </button>
            </Tooltip>
            <Tooltip content={documento.checkRevisor ? 'Revisor aprovado - clique para desmarcar' : documento.checkCalculista ? 'Marcar revisor' : 'Requer calculista primeiro'}>
              <button
                onClick={e => { e.stopPropagation(); if (documento.checkCalculista) onToggleCheck(documento.id, 'revisor', !documento.checkRevisor); }}
                disabled={!documento.checkCalculista}
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${documento.checkRevisor ? 'bg-green-500 border-green-500 text-white' : documento.checkCalculista ? 'border-gray-300 hover:border-green-400' : 'border-gray-200 opacity-40 cursor-not-allowed'}`}
              >
                {documento.checkRevisor && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
              </button>
            </Tooltip>
          </div>
        )}
        <Tooltip content={`Criado em: ${formatDateTime(documento.dataCriacao)}`}>
          <span className="cursor-default flex items-center gap-1">
            <Calendar size={10} className="flex-shrink-0" />
            {formatDateTime(documento.dataCriacao)}
          </span>
        </Tooltip>
        <Tooltip content={`Atualizado em: ${formatDateTime(documento.dataAtualizacao)}`}>
          <span className="cursor-default flex items-center gap-1">
            <Clock size={10} className="flex-shrink-0" />
            {formatDateTime(documento.dataAtualizacao)}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default React.memo(DocumentoCard, (prev, next) => {
  return (
    prev.documento.id === next.documento.id &&
    prev.documento.tipoDocumento === next.documento.tipoDocumento &&
    prev.documento.checkCalculista === next.documento.checkCalculista &&
    prev.documento.checkRevisor === next.documento.checkRevisor &&
    new Date(prev.documento.dataAtualizacao).getTime() === new Date(next.documento.dataAtualizacao).getTime() &&
    prev.isHighlighted === next.isHighlighted
  );
});
