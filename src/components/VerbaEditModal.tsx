import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Verba, VerbaLancamento, NewVerbaLancamento } from '../types/Verba';
import { Decision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { useTipoVerbas } from '../hooks/useTipoVerbas';
import { useToast } from '../contexts/ToastContext';
import { useLancamentosForReference } from '../hooks/useLancamentosForReference';
import { useProcessTable } from '../hooks/useProcessTable';
import logger from '../utils/logger';
import { Save, CreditCard as Edit2, BookOpen, AlertTriangle, Trash2, Calendar, Clock, Check, X } from 'lucide-react';

interface VerbaEditModalProps {
  verba: Verba;
  lancamento: VerbaLancamento;
  decisions: Decision[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<NewVerbaLancamento>) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onVerbasUpdated?: () => void;
  onForceRefreshVerbas?: () => Promise<void>;
}

const SITUACAO_BADGE_COLORS: Record<string, string> = {
  'Deferida': 'bg-green-100 text-green-800 border-green-300',
  'Indeferida': 'bg-red-100 text-red-800 border-red-300',
  'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Em Análise': 'bg-blue-100 text-blue-800 border-blue-300',
  'Reformada': 'bg-sky-100 text-sky-800 border-sky-300',
  'Excluída': 'bg-red-100 text-red-800 border-red-300',
};

function getSituacaoBadgeClass(situacao: string): string {
  return SITUACAO_BADGE_COLORS[situacao] || 'bg-gray-100 text-gray-700 border-gray-300';
}

const VerbaEditModal: React.FC<VerbaEditModalProps> = ({
  verba,
  lancamento,
  decisions,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onVerbasUpdated,
  onForceRefreshVerbas
}) => {
  const {
    isLoading: isTiposLoading,
    error: tiposError,
    carregarTipos,
    validarTipo,
    renomearTipo
  } = useTipoVerbas(verba.processId);

  const toast = useToast();
  const { table: processTable } = useProcessTable(verba.processId);
  const referenceItems = useLancamentosForReference(verba.processId, processTable);

  const [formData, setFormData] = useState<NewVerbaLancamento>({
    decisaoVinculada: '',
    situacao: '',
    fundamentacao: '',
    comentariosCalculistas: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    field: '',
    title: '',
    content: ''
  });

  const [isRenamingTipo, setIsRenamingTipo] = useState(false);
  const [newTipoName, setNewTipoName] = useState('');

  const decisionOptions = useMemo(() => {
    const processDecisions = decisions.filter(d => d.processId === verba.processId);
    return processDecisions.map(d => `${d.idDecisao} - ${d.tipoDecisao}`);
  }, [decisions, verba.processId]);

  useEffect(() => {
    if (lancamento && isOpen) {
      setFormData({
        decisaoVinculada: lancamento.decisaoVinculada,
        situacao: lancamento.situacao,
        fundamentacao: lancamento.fundamentacao || '',
        comentariosCalculistas: lancamento.comentariosCalculistas || ''
      });
      setErrors({});
      setIsRenamingTipo(false);
      setNewTipoName('');
      setShowDeleteConfirm(false);
    }
  }, [lancamento, verba, isOpen]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.decisaoVinculada.trim()) {
      newErrors.decisaoVinculada = 'Decisão vinculada é obrigatória';
    }

    if (!formData.situacao.trim()) {
      newErrors.situacao = 'Situação é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = useCallback((field: keyof NewVerbaLancamento, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const handleStartRenameTipo = useCallback(() => {
    setIsRenamingTipo(true);
    setNewTipoName(verba.tipoVerba);
  }, [verba.tipoVerba]);

  const handleCancelRenameTipo = useCallback(() => {
    setIsRenamingTipo(false);
    setNewTipoName('');
  }, []);

  const handleExecuteRenameTipo = useCallback(async () => {
    try {
      if (!newTipoName.trim() || newTipoName.trim() === verba.tipoVerba) {
        handleCancelRenameTipo();
        return;
      }

      const normalizedNewName = newTipoName.trim()
        .split(' ')
        .map(word => {
          if (word.length === 0) return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');

      const validation = validarTipo(normalizedNewName);
      if (!validation.isValid) {
        toast.error(validation.errorMessage || 'Nome do tipo invalido');
        return;
      }

      setIsSaving(true);

      const result = await renomearTipo(verba.tipoVerba, normalizedNewName, verba.processId);

      if (result.success) {
        window.dispatchEvent(new CustomEvent('verbas-updated'));

        if (onForceRefreshVerbas) {
          await onForceRefreshVerbas();
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        toast.success(`Tipo renomeado com sucesso! ${result.verbasAfetadas} verbas atualizadas.`);
        await carregarTipos(verba.processId);
        onClose();
      } else {
        toast.error(`Erro na renomeacao: ${result.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error(`Erro ao renomear tipo: ${errorMessage}`, 'VerbaEditModal.handleExecuteRenameTipo');
      toast.error(`Erro critico na renomeacao: ${errorMessage}`);
    } finally {
      setIsSaving(false);
      setIsRenamingTipo(false);
      setNewTipoName('');
    }
  }, [newTipoName, verba.tipoVerba, verba.processId, validarTipo, renomearTipo, carregarTipos, onClose, handleCancelRenameTipo, onForceRefreshVerbas, toast]);

  const handleSave = useCallback(async () => {
    if (validateForm()) {
      setIsSaving(true);
      try {
        await onSave(formData);
      } catch (error) {
        logger.error('Falha ao salvar alterações no lançamento', 'VerbaEditModal.handleSave');
      } finally {
        setIsSaving(false);
      }
    }
  }, [formData, validateForm, onSave]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      logger.error('Falha ao excluir lançamento', 'VerbaEditModal.handleDelete');
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, onClose]);

  const handleExpandText = useCallback((field: string, title: string) => {
    const content = field === 'fundamentacao'
      ? formData.fundamentacao || ''
      : formData.comentariosCalculistas || '';

    setExpandedTextModal({
      isOpen: true,
      field: field === 'comentariosCalculistas' ? 'comentarios' : field,
      title,
      content
    });
  }, [formData]);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedTextModal({ isOpen: false, field: '', title: '', content: '' });
  }, []);

  const handleSaveExpandedText = useCallback((content: string) => {
    handleInputChange(expandedTextModal.field as keyof NewVerbaLancamento, content);
    handleCloseExpandedModal();
  }, [expandedTextModal.field, handleInputChange, handleCloseExpandedModal]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.target !== document.querySelector('textarea')) {
      e.preventDefault();
      handleSave();
    }
  }, [onClose, handleSave]);

  if (!isOpen) {
    return null;
  }

  const currentSituacao = formData.situacao || lancamento.situacao;
  const badgeClass = getSituacaoBadgeClass(currentSituacao);

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto"
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <BookOpen size={18} className="text-green-700" />
                </div>
                <div>
                  {isRenamingTipo ? (
                    <div className="flex items-center gap-2 mb-0.5">
                      <input
                        value={newTipoName}
                        onChange={e => setNewTipoName(e.target.value)}
                        className="text-base font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent focus:outline-none pb-0.5"
                        style={{ width: `${Math.max(newTipoName.length + 2, 10)}ch` }}
                        maxLength={100}
                        autoFocus
                      />
                      <button
                        onClick={handleExecuteRenameTipo}
                        disabled={isSaving || !newTipoName.trim() || newTipoName.trim() === verba.tipoVerba}
                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                        title="Confirmar renomeação"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={handleCancelRenameTipo}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-base font-bold text-gray-900">{verba.tipoVerba}</h2>
                      <button
                        onClick={handleStartRenameTipo}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Renomear tipo de verba"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentSituacao && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {currentSituacao}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{lancamento.decisaoVinculada}</span>
                    {lancamento.paginaVinculada != null && (
                      <>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">p. {lancamento.paginaVinculada}</span>
                      </>
                    )}
                  </div>
                  {isRenamingTipo && (
                    <p className="text-xs text-blue-600 mt-1">
                      Renomear atualizará <strong>todos os lançamentos</strong> com este tipo neste processo.
                    </p>
                  )}
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
                label="Decisão Vinculada"
                placeholder="-- Selecione uma decisão --"
                value={formData.decisaoVinculada}
                options={decisionOptions}
                required={true}
                error={errors.decisaoVinculada}
                onChange={(value) => handleInputChange('decisaoVinculada', value)}
              />

              <CustomDropdown
                label="Situação"
                placeholder="Selecione a situação"
                value={formData.situacao}
                required={true}
                error={errors.situacao}
                enumType={DynamicEnumType.SITUACAO_VERBA}
                processId={verba.processId}
                onChange={(value) => handleInputChange('situacao', value)}
              />
            </div>

            <RichTextEditor
              label="Fundamentação"
              placeholder="Fundamentação jurídica da decisão..."
              value={formData.fundamentacao || ''}
              onChange={(value) => handleInputChange('fundamentacao', value)}
              rows={4}
              onExpand={() => handleExpandText('fundamentacao', 'Fundamentação')}
              fieldType="fundamentacao"
              referenceItems={referenceItems}
            />

            <RichTextEditor
              label="Comentários"
              placeholder="Observações e comentários técnicos..."
              value={formData.comentariosCalculistas || ''}
              onChange={(value) => handleInputChange('comentariosCalculistas', value)}
              rows={4}
              onExpand={() => handleExpandText('comentariosCalculistas', 'Comentários')}
              fieldType="comentariosCalculistas"
              referenceItems={referenceItems}
            />

            <div className="pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Calendar size={11} />
                <span>Lançamento criado: {lancamento.dataCriacao.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={11} />
                <span>Verba criada: {verba.dataCriacao.toLocaleString('pt-BR')}</span>
              </div>
              <div className="font-mono truncate col-span-full text-gray-300 text-xs">
                {lancamento.id}
              </div>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Excluir este lançamento?</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {verba.tipoVerba} · {lancamento.decisaoVinculada}. Esta ação não pode ser desfeita.
                  </p>
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
                disabled={isSaving || isDeleting || isRenamingTipo}
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
                disabled={isSaving || isRenamingTipo}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors"
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

export default VerbaEditModal;
