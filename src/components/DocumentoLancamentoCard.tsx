/**
 * DocumentoLancamentoCard - Card component for displaying document releases
 *
 * This component follows the same design pattern as other cards (VerbaLancamentoCard,
 * DecisionCard, DocumentoCard) with a clean, professional layout featuring:
 * - White background with dark text for consistency
 * - Rounded borders with hover effects
 * - Sequential numbering for easy reference
 * - Cyan-colored page number badges
 * - Proper timestamp formatting
 * - Optional edit/delete actions
 */

import React from 'react';
import { Eye } from 'lucide-react';
import { DocumentoLancamento } from '../types';

interface DocumentoLancamentoCardProps {
  documento: DocumentoLancamento;
  index: number;
  showActions?: boolean;
  onEdit?: (documento: DocumentoLancamento) => void;
  onDelete?: (id: string) => void;
  onViewDetails?: (documento: DocumentoLancamento) => void;
}

const DocumentoLancamentoCard: React.FC<DocumentoLancamentoCardProps> = ({
  documento,
  index,
  showActions = false,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = () => {
    onDelete?.(documento.id);
  };

  return (
    <div className="border rounded-lg transition-all duration-200 p-3 mb-2 border-gray-200 bg-white hover:border-gray-300">
      {/* Header with document number and type */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-500">
            {index + 1}
          </span>
          <div className="font-semibold text-gray-900">
            {documento.tipoDocumento}
          </div>
          {documento.paginaVinculada && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded font-medium">
              p.{documento.paginaVinculada}
            </span>
          )}
        </div>

        {/* Action buttons (optional) */}
        {showActions && onEdit && onDelete && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(documento)}
              className="px-2 py-1 text-xs text-cyan-700 hover:text-cyan-800 transition-colors"
              title="Editar documento"
            >
              Editar
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs text-red-700 hover:text-red-800 transition-colors"
              title="Excluir documento"
            >
              Excluir
            </button>
          </div>
        )}
      </div>

      {/* Comments section */}
      {documento.comentarios && (
        <div className="text-sm mt-2">
          <span className="font-medium text-gray-700">Comentários:</span>
          <div
            className="text-gray-600 mt-1 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: documento.comentarios }}
          />
        </div>
      )}

      {/* Timestamps footer */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Lançado em: {formatDate(documento.dataCriacao)}
        </div>
        <div className="flex items-center space-x-3">
          {documento.dataAtualizacao > documento.dataCriacao && (
            <div className="text-xs text-gray-500">
              Atualizado em: {formatDate(documento.dataAtualizacao)}
            </div>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(documento)}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
              title="Ver detalhes completos"
            >
              <Eye size={12} />
              <span>Detalhes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DocumentoLancamentoCard);
