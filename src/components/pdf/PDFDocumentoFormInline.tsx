/**
 * PDFDocumentoFormInline - Compact inline form for documentos in PDF sidebar
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NewDocumento, Documento } from '../../types/Documento';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { DropdownItemAction } from '../ui/CustomDropdown';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';
import { useToast } from '../../contexts/ToastContext';
import { useLancamentosForReference } from '../../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../../hooks/useNavigateToReference';
import { useProcessTable } from '../../hooks/useProcessTable';
import { Save, X, FileText, ArrowLeft, Trash2, AlertTriangle, Calendar, Clock, Check, CreditCard as Edit2 } from 'lucide-react';

interface PDFDocumentoFormInlineProps {
  processId: string;
  onSave: (documento: NewDocumento) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: (id: string) => Promise<boolean>;
  onRenameTipo?: (oldTipo: string, newTipo: string) => Promise<boolean>;
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

function formatDate(date?: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PDFDocumentoFormInline: React.FC<PDFDocumentoFormInlineProps> = ({
  processId,
  onSave,
  onCancel,
  onDelete,
  onRenameTipo,
  editingDocumento = null
}) => {
  const { state, clearHighlightIdsToLink, getCurrentDocument } = usePDFViewer();
  const { refreshEnumValues, renameCustomValue, deleteCustomValue, getPredefinedValues } = useDynamicEnums();
  const toast = useToast();
  const isEditMode = !!editingDocumento;
  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);
  const navigateToReference = useNavigateToReference(processId);

  const handleReferenceClick = useCallback((item: Parameters<typeof navigateToReference>[0]) => {
    navigateToReference(item);
  }, [navigateToReference]);

  const [formData, setFormData] = useState<NewDocumento>({
    tipoDocumento: editingDocumento?.tipoDocumento || '',
    comentarios: editingDocumento?.comentarios || '',
    processId,
    paginaVinculada: editingDocumento?.paginaVinculada || state.currentPage
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isRenamingTipo, setIsRenamingTipo] = useState(false);
  const [renameTipoValue, setRenameTipoValue] = useState('');
  const [deletingTipo, setDeletingTipo] = useState<string | null>(null);
  const [predefinedTipos, setPredefinedTipos] = useState<string[]>([]);

  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    title: '',
    content: ''
  });

  useEffect(() => {
    getPredefinedValues(DynamicEnumType.TIPO_DOCUMENTO).then(setPredefinedTipos);
  }, [getPredefinedValues]);

  useEffect(() => {
    if (isEditMode && editingDocumento) {
      setFormData({
        tipoDocumento: editingDocumento.tipoDocumento || '',
        comentarios: editingDocumento.comentarios || '',
        processId,
        paginaVinculada: editingDocumento.paginaVinculada
      });
    }
    setIsRenamingTipo(false);
  }, [isEditMode, editingDocumento?.id, processId]);

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({ ...prev, paginaVinculada: state.currentPage }));
    }
  }, [state.currentPage, isEditMode]);

  const isSystemTipo = useCallback((tipo: string): boolean => {
    return predefinedTipos.includes(tipo);
  }, [predefinedTipos]);

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

  const handleConfirmRename = useCallback(() => {
    if (renameTipoValue.trim()) {
      setFormData(prev => ({ ...prev, tipoDocumento: renameTipoValue.trim() }));
    }
    setIsRenamingTipo(false);
  }, [renameTipoValue]);

  const handleCancelRename = useCallback(() => {
    setRenameTipoValue(formData.tipoDocumento);
    setIsRenamingTipo(false);
  }, [formData.tipoDocumento]);

  const handleEditarTipo = useCallback((tipo: string) => {
    setIsRenamingTipo(true);
    setRenameTipoValue(tipo);
    setFormData(prev => ({ ...prev, tipoDocumento: tipo }));
  }, []);

  const handleExcluirTipo = useCallback(async (tipo: string) => {
    setDeletingTipo(tipo);
    try {
      const result = await deleteCustomValue(DynamicEnumType.TIPO_DOCUMENTO, tipo, processId);
      if (result.success) {
        toast.success(result.message);
        if (formData.tipoDocumento === tipo) {
          setFormData(prev => ({ ...prev, tipoDocumento: '' }));
        }
        await refreshEnumValues(DynamicEnumType.TIPO_DOCUMENTO, processId);
      } else {
        toast.error(result.message);
      }
    } finally {
      setDeletingTipo(null);
    }
  }, [deleteCustomValue, processId, toast, formData.tipoDocumento, refreshEnumValues]);

  const tipoItemActions: DropdownItemAction = useMemo(() => ({
    onEdit: (tipo: string) => {
      if (!isSystemTipo(tipo)) handleEditarTipo(tipo);
    },
    onDelete: (tipo: string) => {
      if (!isSystemTipo(tipo)) handleExcluirTipo(tipo);
    },
    isDeleting: (tipo: string) => deletingTipo === tipo,
  }), [handleEditarTipo, handleExcluirTipo, deletingTipo, isSystemTipo]);

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

      const savedTipo = formData.tipoDocumento.trim();

      if (isEditMode && editingDocumento && savedTipo !== editingDocumento.tipoDocumento && !isSystemTipo(editingDocumento.tipoDocumento)) {
        const renameResult = await renameCustomValue(DynamicEnumType.TIPO_DOCUMENTO, editingDocumento.tipoDocumento, savedTipo, processId);
        if (!renameResult.success) {
          toast.error(renameResult.message || 'Falha ao renomear tipo de documento.');
          setIsSaving(false);
          return;
        }
        if (onRenameTipo) {
          await onRenameTipo(editingDocumento.tipoDocumento, savedTipo);
        }
        await refreshEnumValues(DynamicEnumType.TIPO_DOCUMENTO, processId);
      }

      const dataToSave: NewDocumento = {
        tipoDocumento: savedTipo,
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

  const handleDelete = async () => {
    if (!editingDocumento?.id || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(editingDocumento.id);
    } finally {
      setIsDeleting(false);
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
  const canRenameTipo = isEditMode && currentTipo && !isSystemTipo(currentTipo);

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
            <div className="p-1.5 bg-orange-100 rounded flex-shrink-0">
              <FileText size={12} className="text-orange-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                {isEditMode && isRenamingTipo ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={renameTipoValue}
                      onChange={e => setRenameTipoValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') handleCancelRename(); }}
                      className="text-xs font-bold text-gray-900 border-b border-orange-500 bg-transparent focus:outline-none"
                      style={{ width: `${Math.max(renameTipoValue.length + 2, 12)}ch` }}
                      autoFocus
                    />
                    <button onClick={handleConfirmRename} className="p-0.5 text-green-600 hover:text-green-700">
                      <Check size={11} />
                    </button>
                    <button onClick={handleCancelRename} className="p-0.5 text-gray-400 hover:text-gray-600">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {currentTipo ? (
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {currentTipo}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {isEditMode ? 'Editar Documento' : 'Novo Documento'}
                      </span>
                    )}
                    {canRenameTipo && (
                      <button
                        onClick={() => { setRenameTipoValue(currentTipo); setIsRenamingTipo(true); }}
                        className="p-0.5 text-gray-400 hover:text-orange-600 flex-shrink-0"
                        title="Renomear tipo"
                      >
                        <Edit2 size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {(formData.paginaVinculada || isEditMode) && (
                <p className="text-xs text-gray-400 truncate">
                  {formData.paginaVinculada ? `p. ${formData.paginaVinculada}` : ''}
                  {formData.paginaVinculada && isEditMode && editingDocumento?.createdAt ? ' · ' : ''}
                  {isEditMode && editingDocumento?.createdAt ? `Criado ${formatDate(editingDocumento.createdAt)}` : ''}
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
        {isEditMode && isRenamingTipo && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2 text-xs text-orange-700">
            Renomear atualizará <strong>todos os documentos</strong> com este tipo.
          </div>
        )}

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
          itemActions={tipoItemActions}
        />

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={formData.paginaVinculada || ''}
              onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
              min={1}
              max={state.totalPages}
              className={`w-14 px-2 py-1.5 text-xs border rounded-md text-center ${errors.paginaVinculada ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-orange-500`}
            />
            {state.totalPages > 0 && (
              <span className="text-xs text-gray-400">de {state.totalPages}</span>
            )}
            {errors.paginaVinculada && (
              <span className="text-red-500 text-xs">{errors.paginaVinculada}</span>
            )}
          </div>
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

        <RichTextEditor
          label="Comentários"
          placeholder="Comentários sobre o documento..."
          value={formData.comentarios || ''}
          onChange={(value) => handleInputChange('comentarios', value)}
          rows={3}
          fieldType="comentariosDocumento"
          referenceItems={referenceItems}
          onReferenceClick={handleReferenceClick}
        />

        {isEditMode && (editingDocumento?.createdAt || editingDocumento?.updatedAt) && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            {editingDocumento.createdAt && (
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>{formatDate(editingDocumento.createdAt)}</span>
              </div>
            )}
            {editingDocumento.updatedAt && (
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{formatDate(editingDocumento.updatedAt)}</span>
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
                Excluir "{editingDocumento?.tipoDocumento}"?
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                {formData.paginaVinculada ? `Documento da p. ${formData.paginaVinculada}. ` : ''}
                Não pode ser desfeito.
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
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-md shadow-sm transition-colors"
          >
            {isSaving ? (
              <><span className="animate-spin text-xs">⟳</span><span>Salvando...</span></>
            ) : (
              <><Save size={11} /><span>Salvar</span></>
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
        placeholder="Comentários sobre o documento..."
      />
    </div>
  );
};

export default React.memo(PDFDocumentoFormInline);
