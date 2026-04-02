import React, { useState, useEffect, useCallback } from 'react';
import { Decision, NewDecision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { useDynamicEnums } from '../hooks/useDynamicEnums';
import logger from '../utils/logger';
import { Save, Scale, AlertTriangle, Trash2, Calendar, Clock } from 'lucide-react';

interface DecisionEditModalProps {
  decision: Decision | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<NewDecision>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const SITUACAO_BADGE_COLORS: Record<string, string> = {
  'Procedente': 'bg-green-100 text-green-800 border-green-300',
  'Improcedente': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Deferido': 'bg-blue-100 text-blue-800 border-blue-300',
  'Indeferido': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Deferido': 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

function getSituacaoBadgeClass(situacao: string): string {
  return SITUACAO_BADGE_COLORS[situacao] || 'bg-gray-100 text-gray-700 border-gray-300';
}

const DecisionEditModal: React.FC<DecisionEditModalProps> = ({
  decision,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const { refreshEnumValues } = useDynamicEnums();

  const [formData, setFormData] = useState<NewDecision>({
    tipoDecisao: '',
    idDecisao: '',
    situacao: '',
    observacoes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    title: '',
    content: ''
  });

  useEffect(() => {
    if (decision && isOpen) {
      setFormData({
        tipoDecisao: decision.tipoDecisao,
        idDecisao: decision.idDecisao,
        situacao: decision.situacao,
        observacoes: decision.observacoes || ''
      });
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [decision, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.tipoDecisao.trim()) {
      newErrors.tipoDecisao = 'Tipo de decisão é obrigatório';
    }

    if (!formData.idDecisao.trim()) {
      newErrors.idDecisao = 'ID da decisão é obrigatório';
    }

    if (!formData.situacao.trim()) {
      newErrors.situacao = 'Situação é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof NewDecision, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    if (!decision) return;

    if (validateForm()) {
      setIsSaving(true);
      try {
        await onSave(decision.id, formData);
      } catch (error) {
        logger.errorWithException(
          'Falha ao salvar alterações na decisão',
          error as Error,
          'DecisionEditModal - handleSave',
          { decisionId: decision.id, formData }
        );
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!decision || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(decision.id);
      onClose();
    } catch (error) {
      logger.errorWithException(
        'Falha ao excluir decisão',
        error as Error,
        'DecisionEditModal - handleDelete',
        { decisionId: decision.id }
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExpandText = useCallback(() => {
    setExpandedTextModal({
      isOpen: true,
      title: 'Observações da Decisão',
      content: formData.observacoes || ''
    });
  }, [formData.observacoes]);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({ isOpen: false, title: '', content: '' });
  }, []);

  const handleSaveExpandedText = useCallback((content: string) => {
    handleInputChange('observacoes', content);
    handleCloseExpandedModal();
  }, [handleCloseExpandedModal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen || !decision) {
    return null;
  }

  const badgeClass = getSituacaoBadgeClass(formData.situacao || decision.situacao);

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
      />

      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-[52.5rem] max-h-screen overflow-y-auto"
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Scale size={18} className="text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-gray-900">{decision.idDecisao}</h2>
                    {(formData.situacao || decision.situacao) && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {formData.situacao || decision.situacao}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formData.tipoDecisao || decision.tipoDecisao}
                    {decision.paginaVinculada != null && ` · p. ${decision.paginaVinculada}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Fechar"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomDropdown
                label="Tipo de Decisão"
                placeholder="Selecione ou crie novo..."
                value={formData.tipoDecisao}
                required={true}
                error={errors.tipoDecisao}
                enumType={DynamicEnumType.TIPO_DECISAO}
                processId={decision.processId}
                onChange={(value) => handleInputChange('tipoDecisao', value)}
                allowCustomValues={true}
                onValueCreated={() => refreshEnumValues(DynamicEnumType.TIPO_DECISAO)}
              />

              <CustomDropdown
                label="Situação"
                placeholder="Selecione ou crie novo..."
                value={formData.situacao}
                required={true}
                error={errors.situacao}
                enumType={DynamicEnumType.SITUACAO_DECISAO}
                processId={decision.processId}
                onChange={(value) => handleInputChange('situacao', value)}
                allowCustomValues={true}
                onValueCreated={() => refreshEnumValues(DynamicEnumType.SITUACAO_DECISAO)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID da Decisão *
              </label>
              <input
                type="text"
                placeholder="Ex: SEN-001, AC-002"
                value={formData.idDecisao}
                onChange={(e) => handleInputChange('idDecisao', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${errors.idDecisao ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.idDecisao && (
                <p className="text-red-500 text-xs mt-1">{errors.idDecisao}</p>
              )}
            </div>

            <RichTextEditor
              label="Observações"
              placeholder="Observações sobre a decisão..."
              value={formData.observacoes}
              onChange={(value) => handleInputChange('observacoes', value)}
              rows={4}
            />

            <div className="pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Calendar size={11} />
                <span>Criado: {decision.dataCriacao.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <Clock size={11} />
                <span className="truncate max-w-[200px]">{decision.id}</span>
              </div>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Excluir decisão "{decision.idDecisao}"?</p>
                  <p className="text-xs text-red-600 mt-0.5">Esta ação não pode ser desfeita.</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
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

          <div className="px-6 pb-6 flex items-center justify-between gap-3">
            {onDelete ? (
              <button
                onClick={() => setShowDeleteConfirm(v => !v)}
                disabled={isSaving || isDeleting}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 ${
                  showDeleteConfirm
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'text-red-500 border-red-200 hover:bg-red-50'
                }`}
              >
                <Trash2 size={14} /> Excluir
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin text-xs">⟳</span>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ExpandedTextModal
        isOpen={expandedTextModal.isOpen}
        onClose={handleCloseExpandedModal}
        onSave={handleSaveExpandedText}
        title={expandedTextModal.title}
        initialContent={expandedTextModal.content}
        placeholder="Observações sobre a decisão..."
      />
    </>
  );
};

export default React.memo(DecisionEditModal);
