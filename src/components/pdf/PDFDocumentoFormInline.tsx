/**
 * PDFDocumentoFormInline - Compact inline form for documentos in PDF sidebar
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NewDocumento, Documento } from '../../types/Documento';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';
import { Save, X, FileText, FileDigit } from 'lucide-react';

interface PDFDocumentoFormInlineProps {
  processId: string;
  onSave: (documento: NewDocumento) => Promise<boolean>;
  onCancel: () => void;
  editingDocumento?: Documento | null;
}

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
        newErrors.paginaVinculada = `Máx. ${state.totalPages}`;
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

  const handleExpandText = useCallback(() => {
    setExpandedTextModal({
      isOpen: true,
      title: 'Comentários do Documento',
      content: formData.comentarios || ''
    });
  }, [formData.comentarios]);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({ isOpen: false, title: '', content: '' });
  }, []);

  const handleSaveExpandedText = useCallback((content: string) => {
    handleInputChange('comentarios', content);
    handleCloseExpandedModal();
  }, [handleCloseExpandedModal]);

  const currentTipo = formData.tipoDocumento;

  return (
    <div className="bg-white border border-orange-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-orange-100 bg-orange-50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 p-1.5 bg-orange-100 rounded-md flex-shrink-0">
              <FileText size={13} className="text-orange-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-orange-900">
                  {isEditMode ? 'Editar Documento' : 'Novo Documento'}
                </span>
                {currentTipo && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${getTipoBadgeClass(currentTipo)}`}>
                    {currentTipo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FileDigit size={10} className="text-orange-500" />
                <span className="text-xs text-orange-600">
                  p. {formData.paginaVinculada || state.currentPage}
                  {state.totalPages > 0 && <span className="text-orange-400"> / {state.totalPages}</span>}
                </span>
                {errors.paginaVinculada && (
                  <span className="text-red-500 text-xs">{errors.paginaVinculada}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded transition-colors flex-shrink-0"
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
            className={`w-20 px-2 py-1 text-xs border rounded-md ${errors.paginaVinculada ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-orange-500`}
          />
          {state.totalPages > 0 && (
            <span className="text-xs text-gray-400">de {state.totalPages}</span>
          )}
        </div>

        {isEditMode && existingHighlightIds.length > 0 && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-blue-700">
                {existingHighlightIds.length} destaque(s) vinculado(s)
              </span>
              {state.highlightIdsToLink.length > 0 && (
                <span className="text-xs text-blue-500">(+{state.highlightIdsToLink.length} novo(s))</span>
              )}
            </div>
            <p className="text-xs text-blue-600 mt-0.5">Novos destaques serão adicionados aos existentes.</p>
          </div>
        )}

        {!isEditMode && state.highlightIdsToLink.length > 0 && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-xs font-medium text-blue-700">
              {state.highlightIdsToLink.length} destaque(s) para vincular
            </span>
          </div>
        )}

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

        <RichTextEditor
          label="Comentários"
          placeholder="Comentários sobre o documento..."
          value={formData.comentarios || ''}
          onChange={(value) => handleInputChange('comentarios', value)}
          rows={3}
          onExpand={handleExpandText}
          fieldType="comentariosDocumento"
        />

        {errors.processId && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-red-700 text-xs">{errors.processId}</p>
          </div>
        )}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-red-700 text-xs">{errors.submit}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
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
        placeholder="Comentários sobre o documento..."
      />
    </div>
  );
};

export default React.memo(PDFDocumentoFormInline);
