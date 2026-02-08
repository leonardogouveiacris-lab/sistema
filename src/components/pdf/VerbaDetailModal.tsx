/**
 * VerbaDetailModal - Full-screen modal for viewing complete lancamento details
 *
 * Features:
 * - Large, readable view of all lancamento information
 * - Rich text rendering with proper formatting
 * - Navigation between lancamentos (previous/next)
 * - Edit and delete actions
 * - Link to associated page in PDF
 * - Maintains PDF visibility in background
 */

import React, { useEffect } from 'react';
import { Verba, VerbaLancamento } from '../../types/Verba';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { X, ChevronLeft, ChevronRight, Edit2, Trash2, FileText } from 'lucide-react';

interface VerbaDetailModalProps {
  verba: Verba;
  lancamento: VerbaLancamento;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lancamentoId: string) => void;
  onDelete: (verbaId: string, lancamentoId: string) => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const VerbaDetailModal: React.FC<VerbaDetailModalProps> = ({
  verba,
  lancamento,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onNavigatePrevious,
  onNavigateNext,
  hasPrevious = false,
  hasNext = false
}) => {
  const { navigateToPageWithHighlight } = usePDFViewer();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleNavigateToPage = () => {
    if (lancamento.paginaVinculada) {
      navigateToPageWithHighlight(lancamento.paginaVinculada, lancamento.id);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete(verba.id, lancamento.id);
    onClose();
  };

  const handleEdit = () => {
    onEdit(lancamento.id);
    onClose();
  };

  const getSituationColor = (situacao: string): string => {
    const colors: Record<string, string> = {
      'Deferida': 'bg-green-100 text-green-800 border-green-300',
      'Indeferida': 'bg-red-100 text-red-800 border-red-300',
      'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Reformada': 'bg-blue-100 text-blue-800 border-blue-300',
      'Excluída': 'bg-gray-100 text-gray-800 border-gray-300',
      'Em Análise': 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[situacao] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] mx-4 bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {verba.tipoVerba}
              </span>
              {lancamento.paginaVinculada && (
                <button
                  onClick={handleNavigateToPage}
                  className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                  title={`Ir para página ${lancamento.paginaVinculada}`}
                >
                  <FileText size={12} />
                  <span>Página {lancamento.paginaVinculada}</span>
                </button>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 truncate">
              {lancamento.decisaoVinculada}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Status Badge */}
          <div className="mb-6">
            <span className={`inline-block px-3 py-1.5 text-sm font-medium rounded-lg border ${getSituationColor(lancamento.situacao)}`}>
              {lancamento.situacao}
            </span>
          </div>

          {/* Fundamentação */}
          {lancamento.fundamentacao && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Fundamentação
              </h3>
              <div
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200"
                dangerouslySetInnerHTML={{ __html: lancamento.fundamentacao }}
              />
            </div>
          )}

          {/* Comentários */}
          {lancamento.comentariosCalculistas && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Comentários
              </h3>
              <div
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200"
                dangerouslySetInnerHTML={{ __html: lancamento.comentariosCalculistas }}
              />
            </div>
          )}

          {/* Timestamps */}
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="mb-1">
              <span className="font-medium">Criado em:</span> {new Date(lancamento.createdAt).toLocaleString('pt-BR')}
            </p>
            {lancamento.updatedAt !== lancamento.createdAt && (
              <p>
                <span className="font-medium">Atualizado em:</span> {new Date(lancamento.updatedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {/* Footer with Actions and Navigation */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            {/* Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onNavigatePrevious}
                disabled={!hasPrevious}
                className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasPrevious
                    ? 'text-gray-700 bg-white hover:bg-gray-100 border border-gray-300'
                    : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                }`}
                title="Lançamento anterior"
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </button>
              <button
                onClick={onNavigateNext}
                disabled={!hasNext}
                className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasNext
                    ? 'text-gray-700 bg-white hover:bg-gray-100 border border-gray-300'
                    : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                }`}
                title="Próximo lançamento"
              >
                <span>Próximo</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleEdit}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
              >
                <Edit2 size={16} />
                <span>Editar</span>
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VerbaDetailModal);
