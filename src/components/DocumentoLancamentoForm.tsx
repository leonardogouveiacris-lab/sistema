import React, { useState, useEffect, useCallback } from 'react';
import { FileText, X, Save, AlertTriangle, Trash2, Calendar, Clock } from 'lucide-react';
import { DocumentoLancamento, DocumentoLancamentoCreateInput, DocumentoLancamentoUpdateInput } from '../types';
import { useToast } from '../contexts/ToastContext';
import { RichTextEditor, ExpandedTextModal } from './ui';
import { useLancamentosForReference } from '../hooks/useLancamentosForReference';
import { useProcessTable } from '../hooks/useProcessTable';
import logger from '../utils/logger';

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

function getTipoBadgeClass(tipo: string): string {
  return TIPO_BADGE_COLORS[tipo] || 'bg-gray-100 text-gray-700 border-gray-300';
}

interface DocumentoLancamentoFormProps {
  processId: string;
  editingDocumento?: DocumentoLancamento | null;
  onSubmit: (data: DocumentoLancamentoCreateInput | DocumentoLancamentoUpdateInput) => Promise<void>;
  onCancel?: () => void;
  onDelete?: (id: string) => Promise<void>;
}

const DocumentoLancamentoForm: React.FC<DocumentoLancamentoFormProps> = ({
  processId,
  editingDocumento,
  onSubmit,
  onCancel,
  onDelete,
}) => {
  const toast = useToast();
  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [paginaVinculada, setPaginaVinculada] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    title: '',
    content: ''
  });

  useEffect(() => {
    if (editingDocumento) {
      setTipoDocumento(editingDocumento.tipoDocumento);
      setComentarios(editingDocumento.comentarios || '');
      setPaginaVinculada(editingDocumento.paginaVinculada?.toString() || '');
      setShowDeleteConfirm(false);
    } else {
      resetForm();
    }
  }, [editingDocumento]);

  const resetForm = () => {
    setTipoDocumento('');
    setComentarios('');
    setPaginaVinculada('');
    setShowDeleteConfirm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tipoDocumento.trim()) {
      toast.warning('Por favor, informe o tipo de documento.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = editingDocumento
        ? {
            tipoDocumento: tipoDocumento.trim(),
            comentarios: comentarios.trim() || undefined,
            paginaVinculada: paginaVinculada ? parseInt(paginaVinculada) : undefined,
          } as DocumentoLancamentoUpdateInput
        : {
            processId,
            tipoDocumento: tipoDocumento.trim(),
            comentarios: comentarios.trim() || undefined,
            paginaVinculada: paginaVinculada ? parseInt(paginaVinculada) : undefined,
          } as DocumentoLancamentoCreateInput;

      await onSubmit(data);

      if (!editingDocumento) {
        resetForm();
      }
    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar lançamento de documento',
        error as Error,
        'DocumentoLancamentoForm.handleSubmit',
        {
          processId,
          editingDocumentoId: editingDocumento?.id,
          paginaVinculada: paginaVinculada ? parseInt(paginaVinculada) : undefined,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    if (onCancel) {
      onCancel();
    }
  };

  const handleDelete = async () => {
    if (!editingDocumento || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(editingDocumento.id);
      if (onCancel) onCancel();
    } catch (error) {
      logger.errorWithException(
        'Falha ao excluir documento',
        error as Error,
        'DocumentoLancamentoForm.handleDelete',
        { documentoId: editingDocumento.id }
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExpandText = useCallback(() => {
    setExpandedTextModal({
      isOpen: true,
      title: 'Comentarios do Documento',
      content: comentarios || ''
    });
  }, [comentarios]);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({ isOpen: false, title: '', content: '' });
  }, []);

  const handleSaveExpandedText = useCallback((content: string) => {
    setComentarios(content);
    handleCloseExpandedModal();
  }, [handleCloseExpandedModal]);

  const isEditing = !!editingDocumento;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <FileText size={16} className="text-orange-600" />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-gray-900">Editar Documento</h3>
                  {tipoDocumento && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getTipoBadgeClass(tipoDocumento)}`}>
                      {tipoDocumento}
                    </span>
                  )}
                </div>
              ) : (
                <h3 className="text-sm font-bold text-gray-900">Novo Documento</h3>
              )}
              {isEditing && editingDocumento.paginaVinculada != null && (
                <p className="text-xs text-gray-400 mt-0.5">p. {editingDocumento.paginaVinculada}</p>
              )}
            </div>
          </div>
          {isEditing && onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label htmlFor="tipoDocumento" className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Documento *
          </label>
          <input
            type="text"
            id="tipoDocumento"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
            placeholder="Ex: Procuração, Contrato de Trabalho, Petição Inicial..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="paginaVinculada" className="block text-sm font-medium text-gray-700 mb-1">
            Página Vinculada
          </label>
          <input
            type="number"
            id="paginaVinculada"
            value={paginaVinculada}
            onChange={(e) => setPaginaVinculada(e.target.value)}
            placeholder="Número da página no PDF"
            min="1"
            className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={isSubmitting}
          />
        </div>

        <RichTextEditor
          label="Comentarios"
          placeholder="Comentarios sobre o documento..."
          value={comentarios}
          onChange={setComentarios}
          rows={3}
          referenceItems={referenceItems}
        />

        {isEditing && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Calendar size={11} />
              <span>Criado: {new Date(editingDocumento.dataCriacao).toLocaleString('pt-BR')}</span>
            </div>
            {editingDocumento.dataAtualizacao > editingDocumento.dataCriacao && (
              <div className="flex items-center gap-1.5">
                <Clock size={11} />
                <span>Atualizado: {new Date(editingDocumento.dataAtualizacao).toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && isEditing && (
        <div className="mx-5 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Excluir "{editingDocumento.tipoDocumento}"?</p>
              {editingDocumento.paginaVinculada != null && (
                <p className="text-xs text-red-600 mt-0.5">p.{editingDocumento.paginaVinculada} · Esta ação não pode ser desfeita.</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-5 flex items-center justify-between gap-3">
        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(v => !v)}
            disabled={isSubmitting || isDeleting}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 ${
              showDeleteConfirm
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'text-red-500 border-red-200 hover:bg-red-50'
            }`}
          >
            <Trash2 size={14} /> Excluir
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          {isEditing && onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin text-xs">⟳</span>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>{isEditing ? 'Salvar Alterações' : 'Adicionar'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ExpandedTextModal
        isOpen={expandedTextModal.isOpen}
        onClose={handleCloseExpandedModal}
        onSave={handleSaveExpandedText}
        title={expandedTextModal.title}
        initialContent={expandedTextModal.content}
        placeholder="Comentarios sobre o documento..."
      />
    </form>
  );
};

export default React.memo(DocumentoLancamentoForm);
