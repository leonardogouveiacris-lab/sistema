/**
 * PDFDecisionFormInline - Compact inline form for decisions in PDF sidebar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NewDecision, Decision } from '../../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';
import { useLancamentosForReference } from '../../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../../hooks/useNavigateToReference';
import { useProcessTable } from '../../hooks/useProcessTable';
import { Save, X, Scale, ArrowLeft, Trash2, AlertTriangle, Calendar, Clock } from 'lucide-react';

interface PDFDecisionFormInlineProps {
  processId: string;
  onSave: (decision: NewDecision) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: (id: string) => Promise<boolean>;
  editingDecision?: Decision | null;
}

const SITUACAO_BADGE_COLORS: Record<string, string> = {
  'Procedente': 'bg-green-100 text-green-800 border-green-300',
  'Improcedente': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Deferido': 'bg-blue-100 text-blue-800 border-blue-300',
  'Indeferido': 'bg-red-100 text-red-800 border-red-300',
};

function getSituacaoBadgeClass(situacao: string): string {
  return SITUACAO_BADGE_COLORS[situacao] || 'bg-gray-100 text-gray-700 border-gray-300';
}

function formatDate(date?: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PDFDecisionFormInline: React.FC<PDFDecisionFormInlineProps> = ({
  processId,
  onSave,
  onCancel,
  onDelete,
  editingDecision = null
}) => {
  const { state } = usePDFViewer();
  const { refreshEnumValues } = useDynamicEnums();
  const isEditMode = !!editingDecision;
  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);
  const navigateToReference = useNavigateToReference(processId);

  const handleReferenceClick = useCallback((item: Parameters<typeof navigateToReference>[0]) => {
    navigateToReference(item);
  }, [navigateToReference]);

  const [formData, setFormData] = useState<NewDecision>({
    tipoDecisao: editingDecision?.tipoDecisao || '',
    idDecisao: editingDecision?.idDecisao || '',
    situacao: editingDecision?.situacao || '',
    observacoes: editingDecision?.observacoes || '',
    processId,
    paginaVinculada: editingDecision?.paginaVinculada || state.currentPage
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    title: '',
    content: ''
  });

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({ ...prev, paginaVinculada: state.currentPage }));
    }
  }, [state.currentPage, isEditMode]);

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

    if (formData.paginaVinculada) {
      if (formData.paginaVinculada < 1) {
        newErrors.paginaVinculada = 'Página deve ser maior que 0';
      } else if (formData.paginaVinculada > state.totalPages) {
        newErrors.paginaVinculada = `Máx. ${state.totalPages}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof NewDecision, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const success = await onSave(formData);
      if (success) {
        if (!isEditMode) {
          setFormData({
            tipoDecisao: '',
            idDecisao: '',
            situacao: '',
            observacoes: '',
            processId,
            paginaVinculada: state.currentPage
          });
        }
        setErrors({});
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingDecision?.id || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(editingDecision.id);
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

  const currentSituacao = formData.situacao;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0"
          >
            <ArrowLeft size={13} />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1.5 bg-blue-100 rounded flex-shrink-0">
              <Scale size={12} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold text-gray-900 truncate">
                  {isEditMode && editingDecision?.idDecisao ? editingDecision.idDecisao : (isEditMode ? 'Editar Decisão' : 'Nova Decisão')}
                </span>
                {currentSituacao && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${getSituacaoBadgeClass(currentSituacao)}`}>
                    {currentSituacao}
                  </span>
                )}
              </div>
              {(formData.tipoDecisao || formData.paginaVinculada) && (
                <p className="text-xs text-gray-400 truncate">
                  {formData.tipoDecisao && <span>{formData.tipoDecisao}</span>}
                  {formData.tipoDecisao && formData.paginaVinculada ? ' · ' : ''}
                  {formData.paginaVinculada ? `p. ${formData.paginaVinculada}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {errors.form && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">{errors.form}</p>
          </div>
        )}

        <CustomDropdown
          label="Tipo de Decisão"
          placeholder="Selecione ou crie novo..."
          value={formData.tipoDecisao}
          required={true}
          error={errors.tipoDecisao}
          enumType={DynamicEnumType.TIPO_DECISAO}
          processId={processId}
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
          processId={processId}
          onChange={(value) => handleInputChange('situacao', value)}
          allowCustomValues={true}
          onValueCreated={() => refreshEnumValues(DynamicEnumType.SITUACAO_DECISAO)}
        />

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            ID da Decisão *
          </label>
          <input
            type="text"
            placeholder="Ex: SEN-001"
            value={formData.idDecisao}
            onChange={(e) => handleInputChange('idDecisao', e.target.value)}
            className={`w-full px-2 py-1.5 text-xs border rounded-md ${errors.idDecisao ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-blue-500`}
          />
          {errors.idDecisao && (
            <p className="text-red-500 text-xs mt-1">{errors.idDecisao}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={formData.paginaVinculada || ''}
              onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
              min={1}
              max={state.totalPages}
              className={`w-14 px-2 py-1.5 text-xs border rounded-md text-center ${errors.paginaVinculada ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-blue-500`}
            />
            {state.totalPages > 0 && (
              <span className="text-xs text-gray-400">de {state.totalPages}</span>
            )}
            {errors.paginaVinculada && (
              <span className="text-red-500 text-xs">{errors.paginaVinculada}</span>
            )}
          </div>
        </div>

        <RichTextEditor
          label="Observações"
          placeholder="Observações..."
          value={formData.observacoes}
          onChange={(value) => handleInputChange('observacoes', value)}
          rows={3}
          fieldType="comentariosDecisao"
          referenceItems={referenceItems}
          onReferenceClick={handleReferenceClick}
        />

        {isEditMode && (editingDecision?.createdAt || editingDecision?.updatedAt) && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            {editingDecision.createdAt && (
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>{formatDate(editingDecision.createdAt)}</span>
              </div>
            )}
            {editingDecision.updatedAt && (
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{formatDate(editingDecision.updatedAt)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="mx-3 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-800">
                Excluir "{editingDecision?.idDecisao}"?
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Lançamentos vinculados serão afetados. Não pode ser desfeito.
              </p>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded disabled:opacity-50"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
        {isEditMode && onDelete ? (
          <button
            onClick={() => setShowDeleteConfirm(v => !v)}
            disabled={isSaving || isDeleting}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
          >
            <Trash2 size={12} /> Excluir
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-1.5">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 border border-gray-300 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md shadow-sm transition-colors"
          >
            {isSaving ? (
              <><span className="animate-spin text-xs">⟳</span><span>Salvando...</span></>
            ) : (
              <><Save size={11} /><span>{isEditMode ? 'Salvar' : 'Salvar'}</span></>
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
        placeholder="Observações..."
      />
    </div>
  );
};

export default React.memo(PDFDecisionFormInline);
