/**
 * PDFVerbaFormInline - Compact inline form for verbas in PDF sidebar
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NewVerbaComLancamento, VerbaLancamento, Verba } from '../../types/Verba';
import { Decision } from '../../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from '../ui';
import { DropdownItemAction } from '../ui/CustomDropdown';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useTipoVerbas } from '../../hooks/useTipoVerbas';
import { useToast } from '../../contexts/ToastContext';
import { useLancamentosForReference } from '../../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../../hooks/useNavigateToReference';
import { useProcessTable } from '../../hooks/useProcessTable';
import { Save, X, BookOpen, ArrowLeft, Trash2, AlertTriangle, Calendar, Clock, Check, CreditCard as Edit2 } from 'lucide-react';

interface PDFVerbaFormInlineProps {
  processId: string;
  decisions: Decision[];
  onSave: (verba: NewVerbaComLancamento) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: (verbaId: string, lancamentoId: string) => Promise<boolean>;
  editingVerba?: { verba: Verba; lancamento: VerbaLancamento } | null;
}

const SITUACAO_BADGE_COLORS: Record<string, string> = {
  'Deferida': 'bg-green-100 text-green-800 border-green-300',
  'Indeferida': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Em Análise': 'bg-blue-100 text-blue-800 border-blue-300',
  'Reformada': 'bg-sky-100 text-sky-800 border-sky-300',
};

function getSituacaoBadgeClass(situacao: string): string {
  return SITUACAO_BADGE_COLORS[situacao] || 'bg-gray-100 text-gray-700 border-gray-300';
}

function formatDate(date?: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PDFVerbaFormInline: React.FC<PDFVerbaFormInlineProps> = ({
  processId,
  decisions,
  onSave,
  onCancel,
  onDelete,
  editingVerba = null
}) => {
  const { state, clearHighlightIdsToLink, getCurrentDocument } = usePDFViewer();
  const { tipos: tiposDisponiveis, isLoading: isTiposLoading, forcarRecarregamento, excluirTipo, renomearTipo } = useTipoVerbas(processId);
  const toast = useToast();
  const isEditMode = !!editingVerba;
  const { table: processTable } = useProcessTable(processId);
  const referenceItems = useLancamentosForReference(processId, processTable);

  const navigateToReference = useNavigateToReference(processId);
  const handleReferenceClick = navigateToReference;

  const [formData, setFormData] = useState<NewVerbaComLancamento>({
    tipoVerba: editingVerba?.verba.tipoVerba || '',
    processId,
    lancamento: {
      decisaoVinculada: editingVerba?.lancamento.decisaoVinculada || '',
      situacao: editingVerba?.lancamento.situacao || '',
      fundamentacao: editingVerba?.lancamento.fundamentacao || '',
      comentariosCalculistas: editingVerba?.lancamento.comentariosCalculistas || '',
      paginaVinculada: editingVerba?.lancamento.paginaVinculada || state.currentPage,
      checkCalculista: editingVerba?.lancamento.checkCalculista ?? false,
      checkRevisor: editingVerba?.lancamento.checkRevisor ?? false,
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenamingTipo, setIsRenamingTipo] = useState(false);
  const [renameTipoValue, setRenameTipoValue] = useState(editingVerba?.verba.tipoVerba || '');
  const [deletingTipo, setDeletingTipo] = useState<string | null>(null);

  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    field: '',
    title: '',
    content: ''
  });

  useEffect(() => {
    setFormData({
      tipoVerba: editingVerba?.verba.tipoVerba || '',
      processId,
      lancamento: {
        decisaoVinculada: editingVerba?.lancamento.decisaoVinculada || '',
        situacao: editingVerba?.lancamento.situacao || '',
        fundamentacao: editingVerba?.lancamento.fundamentacao || '',
        comentariosCalculistas: editingVerba?.lancamento.comentariosCalculistas || '',
        paginaVinculada: editingVerba?.lancamento.paginaVinculada || state.currentPage,
        checkCalculista: editingVerba?.lancamento.checkCalculista ?? false,
        checkRevisor: editingVerba?.lancamento.checkRevisor ?? false,
      }
    });
    setErrors({});
    setShowDeleteConfirm(false);
    setRenameTipoValue(editingVerba?.verba.tipoVerba || '');
    setIsRenamingTipo(false);
  }, [editingVerba?.lancamento.id]);

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
        newErrors.paginaVinculada = `Máx. ${state.totalPages}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = useCallback((field: string, value: string | number | boolean) => {
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

    setErrors(prev => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  }, []);

  const existingHighlightIds = useMemo(() => {
    if (!isEditMode || !editingVerba?.lancamento) return [];
    const storedIds = editingVerba.lancamento.highlightIds ||
           (editingVerba.lancamento.highlightId ? [editingVerba.lancamento.highlightId] : []);
    const currentHighlightIds = new Set(state.highlights.map(h => h.id));
    return storedIds.filter(id => currentHighlightIds.has(id));
  }, [isEditMode, editingVerba, state.highlights]);

  const handleSave = useCallback(async () => {
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
              paginaVinculada: state.currentPage,
              checkCalculista: false,
              checkRevisor: false,
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
  }, [onSave, formData, isEditMode, processId, state.currentPage, state.highlightIdsToLink, existingHighlightIds, clearHighlightIdsToLink, getCurrentDocument, editingVerba]);

  const handleDelete = useCallback(async () => {
    if (!editingVerba?.verba.id || !editingVerba?.lancamento.id || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(editingVerba.verba.id, editingVerba.lancamento.id);
    } finally {
      setIsDeleting(false);
    }
  }, [editingVerba?.verba.id, editingVerba?.lancamento.id, onDelete]);

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

    setExpandedTextModal({ isOpen: true, field: mappedField, title, content });
  }, [formData.lancamento]);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({ isOpen: false, field: '', title: '', content: '' });
  }, []);

  const handleSaveExpandedText = useCallback((content: string) => {
    const originalField = expandedTextModal.field === 'comentarios'
      ? 'comentariosCalculistas'
      : expandedTextModal.field as 'fundamentacao' | 'comentariosCalculistas';

    handleInputChange(originalField, content);
    handleCloseExpandedModal();
  }, [expandedTextModal.field, handleInputChange, handleCloseExpandedModal]);

  const handleConfirmRename = () => {
    if (renameTipoValue.trim()) {
      setFormData(prev => ({ ...prev, tipoVerba: renameTipoValue.trim() }));
    }
    setIsRenamingTipo(false);
  };

  const handleCancelRename = () => {
    setRenameTipoValue(editingVerba?.verba.tipoVerba || formData.tipoVerba);
    setIsRenamingTipo(false);
  };

  const currentSituacao = formData.lancamento.situacao;
  const checkCalculista = formData.lancamento.checkCalculista;
  const checkRevisor = formData.lancamento.checkRevisor;

  const checkCalculistaAt = editingVerba?.lancamento.checkCalculistaAt;
  const checkRevisorAt = editingVerba?.lancamento.checkRevisorAt;

  const handleExcluirTipo = useCallback(async (tipo: string) => {
    setDeletingTipo(tipo);
    try {
      const result = await excluirTipo(tipo, processId);
      if (result.success) {
        toast.success(result.message);
        if (formData.tipoVerba === tipo) {
          setFormData(prev => ({ ...prev, tipoVerba: '' }));
        }
        await forcarRecarregamento();
      } else {
        toast.error(result.message);
      }
    } finally {
      setDeletingTipo(null);
    }
  }, [excluirTipo, processId, toast, formData.tipoVerba, forcarRecarregamento]);

  const handleEditarTipo = useCallback((tipo: string) => {
    setIsRenamingTipo(true);
    setRenameTipoValue(tipo);
    setFormData(prev => ({ ...prev, tipoVerba: tipo }));
  }, []);

  const tipoItemActions: DropdownItemAction = useMemo(() => ({
    onEdit: handleEditarTipo,
    onDelete: handleExcluirTipo,
    isDeleting: (option) => deletingTipo === option
  }), [handleEditarTipo, handleExcluirTipo, deletingTipo]);

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
            <div className="p-1.5 bg-green-100 rounded flex-shrink-0">
              <BookOpen size={12} className="text-green-700" />
            </div>
            <div className="min-w-0">
              {isRenamingTipo ? (
                <div className="flex items-center gap-1 mb-0.5">
                  <input
                    value={renameTipoValue}
                    onChange={e => setRenameTipoValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') handleCancelRename(); }}
                    className="text-xs font-bold text-gray-900 border-b border-blue-500 bg-transparent focus:outline-none"
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
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-sm font-bold text-gray-900 truncate">
                    {formData.tipoVerba || (isEditMode ? 'Editar Verba' : 'Nova Verba')}
                  </span>
                  {formData.tipoVerba && (
                    <button
                      onClick={() => { setRenameTipoValue(formData.tipoVerba); setIsRenamingTipo(true); }}
                      className="p-0.5 text-gray-400 hover:text-blue-600 flex-shrink-0"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 flex-wrap">
                {currentSituacao && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${getSituacaoBadgeClass(currentSituacao)}`}>
                    {currentSituacao}
                  </span>
                )}
                {(formData.lancamento.decisaoVinculada || formData.lancamento.paginaVinculada) && (
                  <span className="text-xs text-gray-400">
                    {formData.lancamento.decisaoVinculada && `· ${formData.lancamento.decisaoVinculada.split(' - ')[0]}`}
                    {formData.lancamento.paginaVinculada ? ` · p.${formData.lancamento.paginaVinculada}` : ''}
                  </span>
                )}
              </div>
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 text-xs text-blue-700">
            Renomear atualizará <strong>todos os lançamentos</strong> com este tipo.
          </div>
        )}

        {errors.form && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">{errors.form}</p>
          </div>
        )}

        {!isEditMode && (
          <CustomDropdown
            label="Tipo de Verba"
            placeholder={isTiposLoading ? "Carregando..." : "Selecione ou crie novo..."}
            value={formData.tipoVerba}
            options={tiposDisponiveis}
            required={true}
            error={errors.tipoVerba}
            disabled={isTiposLoading}
            onChange={(value) => handleInputChange('tipoVerba', value)}
            allowCustomValues={true}
            enumType={DynamicEnumType.TIPO_VERBA}
            processId={processId}
            onValueCreated={forcarRecarregamento}
            itemActions={tipoItemActions}
          />
        )}

        <CustomDropdown
          label="Decisão Vinculada"
          placeholder="Selecione..."
          value={formData.lancamento.decisaoVinculada}
          options={decisionOptions}
          required={true}
          error={errors.decisaoVinculada}
          onChange={(value) => handleInputChange('decisaoVinculada', value)}
        />

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

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={formData.lancamento.paginaVinculada || ''}
              onChange={(e) => handleInputChange('paginaVinculada', parseInt(e.target.value) || 0)}
              min={1}
              max={state.totalPages}
              className={`w-14 px-2 py-1.5 text-xs border rounded-md text-center ${errors.paginaVinculada ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-green-500`}
            />
            {state.totalPages > 0 && (
              <span className="text-xs text-gray-400">de {state.totalPages}</span>
            )}
            {errors.paginaVinculada && (
              <span className="text-red-500 text-xs">{errors.paginaVinculada}</span>
            )}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Checklist de Aprovação</p>
          <div className="space-y-1.5">
            <div
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${checkCalculista ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
              onClick={() => handleInputChange('checkCalculista', !checkCalculista)}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checkCalculista ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                {checkCalculista && <Check size={9} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${checkCalculista ? 'text-blue-800' : 'text-gray-700'}`}>Calculista</p>
                <p className="text-xs text-gray-400">
                  {checkCalculista
                    ? (checkCalculistaAt ? `Verificado em ${formatDate(checkCalculistaAt)}` : 'Verificado')
                    : 'Aguardando'
                  }
                </p>
              </div>
            </div>

            <div
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${checkCalculista ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${checkRevisor ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
              onClick={() => checkCalculista && handleInputChange('checkRevisor', !checkRevisor)}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checkRevisor ? 'bg-green-600' : 'border-2 border-gray-300'}`}>
                {checkRevisor && <Check size={9} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${checkRevisor ? 'text-green-800' : 'text-gray-700'}`}>Revisor</p>
                <p className="text-xs text-gray-400">
                  {checkRevisor
                    ? (checkRevisorAt ? `Verificado em ${formatDate(checkRevisorAt)}` : 'Verificado')
                    : checkCalculista ? 'Aguardando revisão' : 'Requer calculista'
                  }
                </p>
              </div>
            </div>
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
          label="Fundamentação"
          placeholder="Fundamentação jurídica..."
          value={formData.lancamento.fundamentacao || ''}
          onChange={(value) => handleInputChange('fundamentacao', value)}
          rows={3}
          fieldType="fundamentacao"
          referenceItems={referenceItems}
          onReferenceClick={handleReferenceClick}
        />

        <RichTextEditor
          label="Comentários"
          placeholder="Comentários técnicos..."
          value={formData.lancamento.comentariosCalculistas || ''}
          onChange={(value) => handleInputChange('comentariosCalculistas', value)}
          rows={3}
          fieldType="comentariosCalculistas"
          referenceItems={referenceItems}
          onReferenceClick={handleReferenceClick}
        />

        {isEditMode && (editingVerba?.lancamento.createdAt || editingVerba?.lancamento.updatedAt) && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            {editingVerba.lancamento.createdAt && (
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>{formatDate(editingVerba.lancamento.createdAt)}</span>
              </div>
            )}
            {editingVerba.lancamento.updatedAt && (
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{formatDate(editingVerba.lancamento.updatedAt)}</span>
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
              <p className="text-xs font-medium text-red-800">Excluir este lançamento?</p>
              <p className="text-xs text-red-600 mt-0.5">
                {formData.tipoVerba}
                {formData.lancamento.decisaoVinculada ? ` · ${formData.lancamento.decisaoVinculada.split(' - ')[0]}` : ''}
                . Não pode ser desfeito.
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
          checkRevisor ? (
            <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-300 border border-gray-200 rounded-md cursor-not-allowed" title="Lançamento concluído não pode ser excluído">
              <Trash2 size={12} /> Excluir
            </span>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(v => !v)}
              disabled={isSaving || isDeleting}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
            >
              <Trash2 size={12} /> Excluir
            </button>
          )
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
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md shadow-sm transition-colors"
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
