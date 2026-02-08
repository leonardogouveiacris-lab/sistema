/**
 * PDFDecisionFormInline - Compact inline form for decisions in PDF sidebar
 *
 * Features:
 * - Vertical compact layout optimized for sidebar
 * - Auto-fills current page as linked page
 * - Can be used for create or edit mode
 * - Validates page number against document
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NewDecision, Decision } from '../../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';

interface PDFDecisionFormInlineProps {
  processId: string;
  onSave: (decision: NewDecision) => Promise<boolean>;
  onCancel: () => void;
  editingDecision?: Decision | null;
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

  // Estados para o modal de texto expandido
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
        newErrors.paginaVinculada = `Página deve ser menor ou igual a ${state.totalPages}`;
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

  /**
   * Handler para abrir modal de texto expandido
   */
  const handleExpandText = useCallback(() => {
    setExpandedTextModal({
      isOpen: true,
      title: 'Comentarios da Decisao',
      content: formData.observacoes || ''
    });
  }, [formData.observacoes]);

  /**
   * Handler para fechar modal de texto expandido
   */
  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({
      isOpen: false,
      title: '',
      content: ''
    });
  }, []);

  /**
   * Handler para salvar texto do modal expandido
   */
  const handleSaveExpandedText = useCallback((content: string) => {
    handleInputChange('observacoes', content);
    handleCloseExpandedModal();
  }, [handleCloseExpandedModal]);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-900">
          {isEditMode ? 'Editar Decisão' : 'Nova Decisão'}
        </h3>
        <button
          onClick={onCancel}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ×
        </button>
      </div>

      {/* Page Badge */}
      <div className="mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-blue-700">Vinculado à página:</span>
          <input
            type="number"
            value={formData.paginaVinculada || ''}
            onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
            min={1}
            max={state.totalPages}
            className={`w-20 px-2 py-1 text-xs border rounded ${errors.paginaVinculada ? 'border-red-500' : 'border-blue-300'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          <span className="text-xs text-blue-600">de {state.totalPages}</span>
        </div>
        {errors.paginaVinculada && (
          <p className="text-red-500 text-xs mt-1">{errors.paginaVinculada}</p>
        )}
      </div>

      <div className="space-y-3">
        {/* Tipo de Decisão */}
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

        {/* ID da Decisão */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            ID da Decisão *
          </label>
          <input
            type="text"
            placeholder="Ex: SEN-001"
            value={formData.idDecisao}
            onChange={(e) => handleInputChange('idDecisao', e.target.value)}
            className={`w-full px-2 py-1.5 text-xs border rounded ${errors.idDecisao ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {errors.idDecisao && (
            <p className="text-red-500 text-xs mt-1">{errors.idDecisao}</p>
          )}
        </div>

        {/* Situação */}
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

        {/* Comentários */}
        <RichTextEditor
          label="Comentarios"
          placeholder="Comentarios..."
          value={formData.observacoes}
          onChange={(value) => handleInputChange('observacoes', value)}
          rows={3}
          onExpand={handleExpandText}
          fieldType="comentariosDecisao"
        />

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded transition-colors"
          >
            {isSaving ? 'Salvando...' : (isEditMode ? 'Atualizar' : 'Salvar')}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Modal de Texto Expandido */}
      <ExpandedTextModal
        isOpen={expandedTextModal.isOpen}
        onClose={handleCloseExpandedModal}
        onSave={handleSaveExpandedText}
        title={expandedTextModal.title}
        initialContent={expandedTextModal.content}
        placeholder="Comentarios..."
      />
    </div>
  );
};

export default React.memo(PDFDecisionFormInline);
