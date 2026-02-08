/**
 * PDFDocumentoFormInline - Compact inline form for documentos in PDF sidebar
 *
 * Features:
 * - Vertical compact layout optimized for sidebar
 * - Auto-fills current page as linked page
 * - Can be used for create or edit mode
 * - Validates page number against document
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NewDocumento, Documento } from '../../types/Documento';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';

interface PDFDocumentoFormInlineProps {
  processId: string;
  onSave: (documento: NewDocumento) => Promise<boolean>;
  onCancel: () => void;
  editingDocumento?: Documento | null;
}

const PDFDocumentoFormInline: React.FC<PDFDocumentoFormInlineProps> = ({
  processId,
  onSave,
  onCancel,
  editingDocumento = null
}) => {
  const { state, clearHighlightIdsToLink, getCurrentDocument } = usePDFViewer();
  const { refreshEnumValues } = useDynamicEnums();
  const isEditMode = !!editingDocumento;

  const [formData, setFormData] = useState<NewDocumento>({
    tipoDocumento: editingDocumento?.tipoDocumento || '',
    comentarios: editingDocumento?.comentarios || '',
    processId,
    paginaVinculada: editingDocumento?.paginaVinculada || state.currentPage
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
    if (isEditMode && editingDocumento) {
      setFormData({
        tipoDocumento: editingDocumento.tipoDocumento || '',
        comentarios: editingDocumento.comentarios || '',
        processId,
        paginaVinculada: editingDocumento.paginaVinculada
      });
    }
  }, [isEditMode, editingDocumento, processId]);

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({ ...prev, paginaVinculada: state.currentPage }));
    }
  }, [state.currentPage, isEditMode]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!processId || !processId.trim()) {
      newErrors.processId = 'ID do processo é obrigatório';
    }

    if (!formData.tipoDocumento || !formData.tipoDocumento.trim()) {
      newErrors.tipoDocumento = 'Tipo de documento é obrigatório';
    }

    if (formData.paginaVinculada !== undefined && formData.paginaVinculada !== null) {
      if (formData.paginaVinculada < 1) {
        newErrors.paginaVinculada = 'Página deve ser maior que 0';
      } else if (state.totalPages > 0 && formData.paginaVinculada > state.totalPages) {
        newErrors.paginaVinculada = `Página deve ser menor ou igual a ${state.totalPages}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof NewDocumento, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const existingHighlightIds = useMemo(() => {
    if (!isEditMode || !editingDocumento) return [];
    const storedIds = editingDocumento.highlightIds || [];
    const currentHighlightIds = new Set(state.highlights.map(h => h.id));
    return storedIds.filter(id => currentHighlightIds.has(id));
  }, [isEditMode, editingDocumento, state.highlights]);

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const newHighlightIds = state.highlightIdsToLink;
      const currentDoc = getCurrentDocument();

      const combinedHighlightIds = isEditMode
        ? [...new Set([...existingHighlightIds, ...newHighlightIds])]
        : newHighlightIds;

      const dataToSave: NewDocumento = {
        tipoDocumento: formData.tipoDocumento.trim(),
        comentarios: formData.comentarios?.trim() || '',
        processId: processId.trim(),
        paginaVinculada: formData.paginaVinculada || undefined,
        highlightIds: combinedHighlightIds.length > 0 ? combinedHighlightIds : undefined,
        processDocumentId: currentDoc?.id || editingDocumento?.processDocumentId || undefined
      };

      const success = await onSave(dataToSave);

      if (success) {
        if (newHighlightIds.length > 0) {
          clearHighlightIdsToLink();
        }
        if (!isEditMode) {
          setFormData({
            tipoDocumento: '',
            comentarios: '',
            processId,
            paginaVinculada: state.currentPage
          });
        }
        setErrors({});
      } else {
        setErrors({ submit: 'Erro ao salvar documento. A operação retornou falha.' });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido ao salvar documento';
      setErrors({ submit: errorMsg });
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
      title: 'Comentarios do Documento',
      content: formData.comentarios || ''
    });
  }, [formData.comentarios]);

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
    handleInputChange('comentarios', content);
    handleCloseExpandedModal();
  }, [handleCloseExpandedModal]);

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-orange-900">
          {isEditMode ? 'Editar Documento' : 'Novo Documento'}
        </h3>
        <button
          onClick={onCancel}
          className="text-orange-600 hover:text-orange-800 text-sm"
        >
          ×
        </button>
      </div>

      {/* Page Badge */}
      <div className="mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-orange-700">Vinculado à página:</span>
          <input
            type="number"
            value={formData.paginaVinculada || ''}
            onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
            min={1}
            max={state.totalPages}
            className={`w-20 px-2 py-1 text-xs border rounded ${errors.paginaVinculada ? 'border-red-500' : 'border-orange-300'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
          <span className="text-xs text-orange-600">de {state.totalPages}</span>
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
        {/* Tipo de Documento */}
        <CustomDropdown
          label="Tipo de Documento"
          placeholder="Selecione ou digite..."
          value={formData.tipoDocumento}
          required={true}
          error={errors.tipoDocumento}
          onChange={(value) => handleInputChange('tipoDocumento', value)}
          allowCustomValues={true}
          enumType={DynamicEnumType.TIPO_DOCUMENTO}
          processId={processId}
          onValueCreated={() => refreshEnumValues(DynamicEnumType.TIPO_DOCUMENTO)}
        />

        {/* Comentários */}
        <RichTextEditor
          label="Comentarios"
          placeholder="Comentarios sobre o documento..."
          value={formData.comentarios || ''}
          onChange={(value) => handleInputChange('comentarios', value)}
          rows={3}
          onExpand={handleExpandText}
          fieldType="comentariosDocumento"
        />

        {/* Error Messages */}
        {errors.processId && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <p className="text-red-700 text-xs font-semibold">Erro de Processo:</p>
            <p className="text-red-700 text-xs">{errors.processId}</p>
          </div>
        )}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <p className="text-red-700 text-xs font-semibold">Erro ao Salvar:</p>
            <p className="text-red-700 text-xs">{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 rounded transition-colors"
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
        placeholder="Comentarios sobre o documento..."
      />
    </div>
  );
};

export default React.memo(PDFDocumentoFormInline);
