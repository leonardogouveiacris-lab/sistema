/**
 * Componente VerbaForm - Formulário para cadastro de verbas
 * Permite criar uma nova verba vinculada a um processo e decisão específicos
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { NewVerbaComLancamento } from '../types/Verba';
import { Decision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { ValidationUtils } from '../utils';
import { useTipoVerbas } from '../hooks/useTipoVerbas';
import { Save, Plus, AlertTriangle, RotateCcw, X } from 'lucide-react';

interface VerbaFormProps {
  processId: string;
  decisions: Decision[];
  onSaveVerba: (verba: NewVerbaComLancamento) => Promise<boolean>;
  isLoading?: boolean;
  refreshTrigger?: number;
}

const VerbaForm: React.FC<VerbaFormProps> = ({
  processId,
  decisions,
  onSaveVerba,
  isLoading = false,
  refreshTrigger = 0
}) => {
  const {
    tipos: tiposDisponiveis,
    isLoading: isTiposLoading,
    error: tiposError,
    carregarTipos,
    validarTipo,
    forcarRecarregamento
  } = useTipoVerbas(processId);

  const initialFormData = useMemo((): NewVerbaComLancamento => ({
    tipoVerba: '',
    processId,
    lancamento: {
      decisaoVinculada: '',
      situacao: '',
      fundamentacao: '',
      comentariosCalculistas: ''
    }
  }), [processId]);

  const draftKey = `verba_form_draft_${processId}`;

  const [formData, setFormData] = useState<NewVerbaComLancamento>(() => {
    try {
      const raw = localStorage.getItem(`verba_form_draft_${processId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as NewVerbaComLancamento;
        if (parsed.processId === processId) return parsed;
      }
    } catch {}
    return {
      tipoVerba: '',
      processId,
      lancamento: {
        decisaoVinculada: '',
        situacao: '',
        fundamentacao: '',
        comentariosCalculistas: ''
      }
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`verba_form_draft_${processId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as NewVerbaComLancamento;
        const hasContent = parsed.tipoVerba || parsed.lancamento.fundamentacao || parsed.lancamento.situacao || parsed.lancamento.decisaoVinculada;
        return !!(parsed.processId === processId && hasContent);
      }
    } catch {}
    return false;
  });

  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    field: '',
    title: '',
    content: ''
  });

  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (refreshTrigger > 0) {
      carregarTipos(processId);
    }
  }, [refreshTrigger, carregarTipos, processId]);

  useEffect(() => {
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      const hasContent = formData.tipoVerba || formData.lancamento.fundamentacao ||
        formData.lancamento.situacao || formData.lancamento.decisaoVinculada ||
        formData.lancamento.comentariosCalculistas;
      if (hasContent) {
        try { localStorage.setItem(draftKey, JSON.stringify(formData)); } catch {}
      } else {
        try { localStorage.removeItem(draftKey); } catch {}
      }
    }, 800);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
  }, [formData, draftKey]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch {}
    setDraftRestored(false);
  }, [draftKey]);

  const decisionOptions = useMemo(() => {
    const processDecisions = decisions.filter(d => d.processId === processId);
    return processDecisions.map(d => `${d.idDecisao} - ${d.tipoDecisao}`);
  }, [decisions, processId]);

  const validateForm = useCallback((): boolean => {
    const validation = ValidationUtils.validateNewVerbaComLancamento(formData);
    setErrors(validation.errors);
    return validation.isValid;
  }, [formData]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setSaveError(null);
    if (field === 'tipoVerba') {
      const validation = validarTipo(value);
      if (!validation.isValid && value.trim()) {
        setErrors(prev => ({ ...prev, tipoVerba: validation.errorMessage || 'Tipo inválido' }));
      } else {
        setErrors(prev => ({ ...prev, tipoVerba: '' }));
      }
      setFormData(prev => ({ ...prev, tipoVerba: value }));
    } else {
      setFormData(prev => ({
        ...prev,
        lancamento: { ...prev.lancamento, [field]: value }
      }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors, validarTipo]);

  const handleSaveVerba = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const success = await onSaveVerba(formData);
      if (success) {
        clearDraft();
        await carregarTipos(processId);
        setFormData(initialFormData);
        setErrors({});
      } else {
        setSaveError('Não foi possível salvar. Seus dados estão preservados acima — tente novamente.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setSaveError(msg || 'Não foi possível salvar. Seus dados estão preservados acima — tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, onSaveVerba, initialFormData, carregarTipos, processId, clearDraft]);

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

  const handleFundamentacaoChange = useCallback(
    (value: string) => handleInputChange('fundamentacao', value),
    [handleInputChange]
  );

  const handleComentariosCalculistasChange = useCallback(
    (value: string) => handleInputChange('comentariosCalculistas', value),
    [handleInputChange]
  );

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

  const handleReset = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setSaveError(null);
    clearDraft();
  }, [initialFormData, clearDraft]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveVerba();
    }
  }, [handleSaveVerba]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Carregando sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">

        {draftRestored && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <RotateCcw size={14} />
              <span>Rascunho anterior recuperado — seus dados foram restaurados automaticamente.</span>
            </div>
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="text-blue-400 hover:text-blue-600 transition-colors"
              aria-label="Fechar aviso"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {saveError && (
          <div className="mb-4 flex items-start space-x-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Falha ao salvar</p>
              <p className="text-sm text-red-700 mt-0.5">{saveError}</p>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-red-400 hover:text-red-600 transition-colors shrink-0"
              aria-label="Fechar erro"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Cadastro de Verbas</h2>
          <p className="text-sm text-gray-600 mt-1">
            Registre as verbas e suas situações
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Plus size={14} className="text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">Nova Verba</h3>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveVerba(); }} onKeyDown={handleKeyDown}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CustomDropdown
                  label="Tipo de Verba"
                  placeholder={isTiposLoading ? "Carregando tipos..." : "-- Selecione um tipo --"}
                  value={formData.tipoVerba}
                  options={tiposDisponiveis}
                  required={true}
                  error={errors.tipoVerba || (tiposError ? `Erro: ${tiposError}` : '')}
                  disabled={isTiposLoading || isLoading}
                  onChange={(value) => handleInputChange('tipoVerba', value)}
                  onValueCreated={forcarRecarregamento}
                />

                <CustomDropdown
                  label="Decisão Vinculada"
                  placeholder="-- Selecione uma decisão --"
                  value={formData.lancamento.decisaoVinculada}
                  options={decisionOptions}
                  required={true}
                  error={errors.decisaoVinculada}
                  onChange={(value) => handleInputChange('decisaoVinculada', value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CustomDropdown
                  label="Situação"
                  placeholder="Selecione ou crie nova situação"
                  value={formData.lancamento.situacao}
                  required={true}
                  error={errors.situacao}
                  enumType={DynamicEnumType.SITUACAO_VERBA}
                  processId={processId}
                  onChange={(value) => handleInputChange('situacao', value)}
                  allowCustomValues={true}
                />
              </div>

              <RichTextEditor
                label="Fundamentação"
                placeholder="Fundamentação jurídica da decisão..."
                value={formData.lancamento.fundamentacao || ''}
                onChange={handleFundamentacaoChange}
                rows={4}
                fieldType="fundamentacao"
              />

              <RichTextEditor
                label="Comentários"
                placeholder="Observações e comentários técnicos..."
                value={formData.lancamento.comentariosCalculistas || ''}
                onChange={handleComentariosCalculistasChange}
                rows={4}
                fieldType="comentariosCalculistas"
              />

              <div className="flex justify-center pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Salvar Verba</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
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
            ? 'Fundamentação jurídica da decisão...'
            : 'Observações e comentários técnicos...'
        }
      />
    </>
  );
};

export default React.memo(VerbaForm);
