import React, { useState, useEffect, useCallback } from 'react';
import { FileText, X } from 'lucide-react';
import { DocumentoLancamento, DocumentoLancamentoCreateInput, DocumentoLancamentoUpdateInput } from '../types';
import { useToast } from '../contexts/ToastContext';
import { RichTextEditor, ExpandedTextModal } from './ui';

interface DocumentoLancamentoFormProps {
  processId: string;
  editingDocumento?: DocumentoLancamento | null;
  onSubmit: (data: DocumentoLancamentoCreateInput | DocumentoLancamentoUpdateInput) => Promise<void>;
  onCancel?: () => void;
}

const DocumentoLancamentoForm: React.FC<DocumentoLancamentoFormProps> = ({
  processId,
  editingDocumento,
  onSubmit,
  onCancel,
}) => {
  const toast = useToast();
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [paginaVinculada, setPaginaVinculada] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    } else {
      resetForm();
    }
  }, [editingDocumento]);

  const resetForm = () => {
    setTipoDocumento('');
    setComentarios('');
    setPaginaVinculada('');
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
      console.error('Error submitting document launch:', error);
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

  const handleExpandText = useCallback(() => {
    setExpandedTextModal({
      isOpen: true,
      title: 'Comentarios do Documento',
      content: comentarios || ''
    });
  }, [comentarios]);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({
      isOpen: false,
      title: '',
      content: ''
    });
  }, []);

  const handleSaveExpandedText = useCallback((content: string) => {
    setComentarios(content);
    handleCloseExpandedModal();
  }, [handleCloseExpandedModal]);

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">
            {editingDocumento ? 'Editar Documento' : 'Novo Lançamento de Documento'}
          </h3>
        </div>
        {editingDocumento && onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>

        <RichTextEditor
          label="Comentarios"
          placeholder="Comentarios sobre o documento..."
          value={comentarios}
          onChange={setComentarios}
          rows={3}
          onExpand={handleExpandText}
        />

        <div className="flex items-center justify-end space-x-3 pt-2">
          {editingDocumento && onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : editingDocumento ? 'Atualizar' : 'Adicionar'}
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

export default DocumentoLancamentoForm;
