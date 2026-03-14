/**
 * PDFDecisionFormInline - Compact inline form for decisions in PDF sidebar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NewDecision, Decision } from '../../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';
import { Save, X, Scale, FileDigit } from 'lucide-react';

interface PDFDecisionFormInlineProps {
  processId: string;
  onSave: (decision: NewDecision) => Promise<boolean>;
  onCancel: () => void;
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

const PDFDecisionFormInline: React.FC<PDFDecisionFormInlineProps> = ({
  processId,
  onSave,
  onCancel,
  editingDecision = null
}) => {
  const { state } = usePDFViewer();
  const { refreshEnumValues } = useDynamicEnums();
  const isEditMode = !!editingDecision;

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
    <div className="bg-white border border-blue-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-blue-100 bg-blue-50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 p-1.5 bg-blue-100 rounded-md flex-shrink-0">
              <Scale size={13} className="text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-blue-900">
                  {isEditMode ? 'Editar Decisão' : 'Nova Decisão'}
                </span>
                {isEditMode && editingDecision?.idDecisao && (
                  <span className="text-xs text-blue-700 font-medium">{editingDecision.idDecisao}</span>
                )}
                {currentSituacao && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${getSituacaoBadgeClass(currentSituacao)}`}>
                    {currentSituacao}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FileDigit size={10} className="text-blue-500" />
                <span className="text-xs text-blue-600">
                  p. {formData.paginaVinculada || state.currentPage}
                  {state.totalPages > 0 && <span className="text-blue-400"> / {state.totalPages}</span>}
                </span>
                {errors.paginaVinculada && (
                  <span className="text-red-500 text-xs">{errors.paginaVinculada}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex-shrink-0">p.</span>
          <input
            type="number"
            value={formData.paginaVinculada || ''}
            onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
            min={1}
            max={state.totalPages}
            className={`w-20 px-2 py-1 text-xs border rounded-md ${errors.paginaVinculada ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-blue-500`}
          />
          {state.totalPages > 0 && (
            <span className="text-xs text-gray-400">de {state.totalPages}</span>
          )}
        </div>

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

        <RichTextEditor
          label="Observações"
          placeholder="Observações..."
          value={formData.observacoes}
          onChange={(value) => handleInputChange('observacoes', value)}
          rows={3}
          onExpand={handleExpandText}
          fieldType="comentariosDecisao"
        />

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {isSaving ? (
              <><span className="animate-spin text-xs">⟳</span><span>Salvando...</span></>
            ) : (
              <><Save size={12} /><span>{isEditMode ? 'Salvar Alterações' : 'Salvar'}</span></>
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 border border-gray-300 rounded-lg transition-colors"
          >
            Cancelar
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
