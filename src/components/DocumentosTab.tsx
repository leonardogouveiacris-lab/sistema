import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { DocumentoLancamento, DocumentoLancamentoCreateInput, DocumentoLancamentoUpdateInput } from '../types';
import { useDocumentoLancamentos } from '../hooks';
import DocumentoLancamentoForm from './DocumentoLancamentoForm';
import DocumentoLancamentoList from './DocumentoLancamentoList';
import { LoadingSpinner } from './ui';

interface DocumentosTabProps {
  processId: string;
}

const DocumentosTab: React.FC<DocumentosTabProps> = ({ processId }) => {
  const [editingDocumento, setEditingDocumento] = useState<DocumentoLancamento | null>(null);
  const {
    documentos,
    loading,
    error,
    createDocumento,
    updateDocumento,
    deleteDocumento,
  } = useDocumentoLancamentos(processId);

  const handleSubmit = async (data: DocumentoLancamentoCreateInput | DocumentoLancamentoUpdateInput) => {
    if (editingDocumento) {
      const result = await updateDocumento(editingDocumento.id, data as DocumentoLancamentoUpdateInput);
      if (result) {
        setEditingDocumento(null);
      }
    } else {
      await createDocumento(data as DocumentoLancamentoCreateInput);
    }
  };

  const handleEdit = (documento: DocumentoLancamento) => {
    setEditingDocumento(documento);
  };

  const handleCancelEdit = () => {
    setEditingDocumento(null);
  };

  const handleDelete = async (id: string) => {
    await deleteDocumento(id);
  };

  if (loading && documentos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-4">
        <FileText className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Lançamentos de Documentos</h2>
          <p className="text-sm text-gray-600">
            Gerencie documentos vinculados ao processo
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <DocumentoLancamentoForm
        processId={processId}
        editingDocumento={editingDocumento}
        onSubmit={handleSubmit}
        onCancel={editingDocumento ? handleCancelEdit : undefined}
      />

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Documentos Cadastrados ({documentos.length})
        </h3>
        <DocumentoLancamentoList
          documentos={documentos}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};

export default DocumentosTab;
