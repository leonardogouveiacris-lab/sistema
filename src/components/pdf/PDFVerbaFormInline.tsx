/**
 * PDFVerbaFormInline - Compact inline form for verbas in PDF sidebar
 *
 * Features:
 * - Vertical compact layout optimized for sidebar
 * - Auto-fills current page as linked page
 * - Can be used for create or edit mode
 * - Maintains hierarchical structure (verba + lancamento)
 * - Simplified version of main form for quick entry
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NewVerbaComLancamento, VerbaLancamento, Verba } from '../../types/Verba';
import { Decision } from '../../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useTipoVerbas } from '../../hooks/useTipoVerbas';

interface PDFVerbaFormInlineProps {
  processId: string;
  decisions: Decision[];
  onSave: (verba: NewVerbaComLancamento) => Promise<boolean>;
  onCancel: () => void;
  editingVerba?: { verba: Verba; lancamento: VerbaLancamento } | null;
}

const PDFVerbaFormInline: React.FC<PDFVerbaFormInlineProps> = ({
  processId,
  decisions,
  onSave,
  onCancel,
  editingVerba = null
}) => {
  const { state, clearHighlightIdsToLink, getCurrentDocument } = usePDFViewer();
  const { tipos: tiposDisponiveis, isLoading: isTiposLoading, forcarRecarregamento } = useTipoVerbas(processId);
  const isEditMode = !!editingVerba;

  const [formData, setFormData] = useState<NewVerbaComLancamento>({
    tipoVerba: editingVerba?.verba.tipoVerba || '',
    processId,
    lancamento: {
      decisaoVinculada: editingVerba?.lancamento.decisaoVinculada || '',
      situacao: editingVerba?.lancamento.situacao || '',
      fundamentacao: editingVerba?.lancamento.fundamentacao || '',
      comentariosCalculistas: editingVerba?.lancamento.comentariosCalculistas || '',
      paginaVinculada: editingVerba?.lancamento.paginaVinculada || state.currentPage
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Estados para o modal de texto expandido
  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    field: '',
    title: '',
    content: ''
  });

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({
        ...prev,
        lancamento: {
          ...prev.lancamento,
          paginaVinculada: state.currentPage
        }
      }));
    }
  }, [state.currentPage, isEditMode]);

  const decisionOptions = useMemo(() => {
    const processDecisions = decisions.filter(d => d.processId === processId);
    return processDecisions.map(d => `${d.idDecisao} - ${d.tipoDecisao}`);
  }, [decisions, processId]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.tipoVerba.trim()) {
      newErrors.tipoVerba = 'Tipo de verba é obrigatório';
    }

    if (!formData.lancamento.decisaoVinculada.trim()) {
      newErrors.decisaoVinculada = 'Decisão vinculada é obrigatória';
    }

    if (!formData.lancamento.situacao.trim()) {
      newErrors.situacao = 'Situação é obrigatória';
    }

    if (formData.lancamento.paginaVinculada) {
      if (formData.lancamento.paginaVinculada < 1) {
        newErrors.paginaVinculada = 'Página deve ser maior que 0';
      } else if (formData.lancamento.paginaVinculada > state.totalPages) {
        newErrors.paginaVinculada = `Página deve ser menor ou igual a ${state.totalPages}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | number) => {
    if (field === 'tipoVerba') {
      setFormData(prev => ({ ...prev, tipoVerba: value as string }));
    } else if (field === 'paginaVinculada') {
      setFormData(prev => ({
        ...prev,
        lancamento: { ...prev.lancamento, paginaVinculada: value as number }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        lancamento: { ...prev.lancamento, [field]: value }
      }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const existingHighlightIds = useMemo(() => {
    if (!isEditMode || !editingVerba?.lancamento) return [];
    const storedIds = editingVerba.lancamento.highlightIds ||
           (editingVerba.lancamento.highlightId ? [editingVerba.lancamento.highlightId] : []);
    const currentHighlightIds = new Set(state.highlights.map(h => h.id));
    return storedIds.filter(id => currentHighlightIds.has(id));
  }, [isEditMode, editingVerba, state.highlights]);

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const newHighlightIds = state.highlightIdsToLink;
    const currentDoc = getCurrentDocument();

    const combinedHighlightIds = isEditMode
      ? [...new Set([...existingHighlightIds, ...newHighlightIds])]
      : newHighlightIds;

    const formDataWithHighlight: NewVerbaComLancamento = {
      ...formData,
      lancamento: {
        ...formData.lancamento,
        highlightIds: combinedHighlightIds.length > 0 ? combinedHighlightIds : undefined,
        processDocumentId: currentDoc?.id || editingVerba?.lancamento.processDocumentId || undefined
      }
    };

    setIsSaving(true);
    try {
      const success = await onSave(formDataWithHighlight);

      if (success) {
        if (newHighlightIds.length > 0) {
          clearHighlightIdsToLink();
        }

        if (!isEditMode) {
          setFormData({
            tipoVerba: '',
            processId,
            lancamento: {
              decisaoVinculada: '',
              situacao: '',
              fundamentacao: '',
              comentariosCalculistas: '',
              paginaVinculada: state.currentPage
            }
          });
          setErrors({});
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao salvar';
      setErrors({ form: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handler para abrir modal de texto expandido
   */
  const handleExpandText = useCallback((field: string, title: string) => {
    let content = '';
    let mappedField = field;

    if (field === 'fundamentacao') {
      content = formData.lancamento.fundamentacao || '';
      mappedField = 'fundamentacao';
    } else if (field === 'comentariosCalculistas') {
      content = formData.lancamento.comentariosCalculistas || '';
      mappedField = 'comentarios';
    }

    setExpandedTextModal({
      isOpen: true,
      field: mappedField,
      title,
      content
    });
  }, [formData.lancamento]);

  /**
   * Handler para fechar modal de texto expandido
   */
  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({
      isOpen: false,
      field: '',
      title: '',
      content: ''
    });
  }, []);

  /**
   * Handler para salvar texto do modal expandido
   */
  const handleSaveExpandedText = useCallback((content: string) => {
    const originalField = expandedTextModal.field === 'comentarios'
      ? 'comentariosCalculistas'
      : expandedTextModal.field as 'fundamentacao' | 'comentariosCalculistas';

    handleInputChange(originalField, content);
    handleCloseExpandedModal();
  }, [expandedTextModal.field, handleCloseExpandedModal]);

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-green-900">
          {isEditMode ? 'Editar Verba' : 'Nova Verba'}
        </h3>
        <button
          onClick={onCancel}
          className="text-green-600 hover:text-green-800 text-sm"
        >
          ×
        </button>
      </div>

      {/* Form-level Error Display */}
      {errors.form && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">{errors.form}</p>
        </div>
      )}

      {/* Page Badge */}
      <div className="mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-green-700">Vinculado à página:</span>
          <input
            type="number"
            value={formData.lancamento.paginaVinculada || ''}
            onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
            min={1}
            max={state.totalPages}
            className={`w-20 px-2 py-1 text-xs border rounded ${errors.paginaVinculada ? 'border-red-500' : 'border-green-300'} focus:outline-none focus:ring-2 focus:ring-green-500`}
          />
          <span className="text-xs text-green-600">de {state.totalPages}</span>
        </div>
        {errors.paginaVinculada && (
          <p className="text-red-500 text-xs mt-1">{errors.paginaVinculada}</p>
        )}
      </div>

      {/* Existing Highlights Indicator */}
      {isEditMode && existingHighlightIds.length > 0 && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-blue-700">
              {existingHighlightIds.length} destaque(s) vinculado(s)
            </span>
            {state.highlightIdsToLink.length > 0 && (
              <span className="text-xs text-blue-600">
                (+{state.highlightIdsToLink.length} novo(s))
              </span>
            )}
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Novos destaques serao adicionados aos existentes.
          </p>
        </div>
      )}

      {/* New Highlights Indicator (Create Mode) */}
      {!isEditMode && state.highlightIdsToLink.length > 0 && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs font-medium text-blue-700">
            {state.highlightIdsToLink.length} destaque(s) para vincular
          </span>
        </div>
      )}

      <div className="space-y-3">
        {/* Tipo de Verba */}
        <CustomDropdown
          label="Tipo de Verba"
          placeholder={isTiposLoading ? "Carregando..." : "Selecione ou crie novo..."}
          value={formData.tipoVerba}
          options={tiposDisponiveis}
          required={true}
          error={errors.tipoVerba}
          disabled={isTiposLoading || isEditMode}
          onChange={(value) => handleInputChange('tipoVerba', value)}
          allowCustomValues={!isEditMode}
          enumType={DynamicEnumType.TIPO_VERBA}
          processId={processId}
          onValueCreated={forcarRecarregamento}
        />

        {/* Decisão Vinculada */}
        <CustomDropdown
          label="Decisão Vinculada"
          placeholder="Selecione..."
          value={formData.lancamento.decisaoVinculada}
          options={decisionOptions}
          required={true}
          error={errors.decisaoVinculada}
          onChange={(value) => handleInputChange('decisaoVinculada', value)}
        />

        {/* Situação */}
        <CustomDropdown
          label="Situação"
          placeholder="Selecione ou crie nova..."
          value={formData.lancamento.situacao}
          required={true}
          error={errors.situacao}
          enumType={DynamicEnumType.SITUACAO_VERBA}
          processId={processId}
          onChange={(value) => handleInputChange('situacao', value)}
          allowCustomValues={true}
        />

        {/* Fundamentação (Compact) */}
        <RichTextEditor
          label="Fundamentação"
          placeholder="Fundamentação jurídica..."
          value={formData.lancamento.fundamentacao || ''}
          onChange={(value) => handleInputChange('fundamentacao', value)}
          rows={3}
          onExpand={() => handleExpandText('fundamentacao', 'Fundamentação')}
          fieldType="fundamentacao"
        />

        {/* Comentários (Compact) */}
        <RichTextEditor
          label="Comentários"
          placeholder="Comentários técnicos..."
          value={formData.lancamento.comentariosCalculistas || ''}
          onChange={(value) => handleInputChange('comentariosCalculistas', value)}
          rows={3}
          onExpand={() => handleExpandText('comentariosCalculistas', 'Comentários')}
          fieldType="comentariosCalculistas"
        />

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed rounded transition-colors"
          >
            {isSaving ? 'Salvando...' : (isEditMode ? 'Atualizar' : 'Salvar')}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 rounded transition-colors"
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
        dataField={expandedTextModal.field}
        placeholder={
          expandedTextModal.field === 'fundamentacao'
            ? 'Fundamentação jurídica...'
            : 'Comentários técnicos...'
        }
      />
    </div>
  );
};

export default React.memo(PDFVerbaFormInline);
