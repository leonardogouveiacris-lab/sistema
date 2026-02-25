/**
 * Componente VerbaEditModal - Modal para edição de lançamentos de verbas
 * 
 * Funcionalidades:
 * - Carrega dados do lançamento selecionado
 * - Permite editar todos os campos do lançamento
 * - Validação de campos obrigatórios
 * - Modal responsivo com backdrop
 * - Integração com o design system
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Verba, VerbaLancamento, NewVerbaLancamento } from '../types/Verba';
import { Decision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { useTipoVerbas } from '../hooks/useTipoVerbas';
import { useToast } from '../contexts/ToastContext';
import logger from '../utils/logger';
import { Save, Edit2 } from 'lucide-react';

/**
 * Props do componente VerbaEditModal
 */
interface VerbaEditModalProps {
  verba: Verba;
  lancamento: VerbaLancamento;
  decisions: Decision[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<NewVerbaLancamento>) => Promise<void> | void;
  onVerbasUpdated?: () => void;
  onForceRefreshVerbas?: () => Promise<void>;
}

/**
 * Componente VerbaEditModal
 */
const VerbaEditModal: React.FC<VerbaEditModalProps> = ({
  verba,
  lancamento,
  decisions,
  isOpen,
  onClose,
  onSave,
  onVerbasUpdated,
  onForceRefreshVerbas
}) => {
  // Hook simplificado para tipos de verba - contextualizado por processo
  const {
    tipos: tiposDisponiveis,
    isLoading: isTiposLoading,
    error: tiposError,
    carregarTipos,
    validarTipo,
    renomearTipo
  } = useTipoVerbas(verba.processId); // Passa processId da verba diretamente para o hook

  const toast = useToast();

  // Estado do formulário de edição
  const [formData, setFormData] = useState<NewVerbaLancamento>({
    decisaoVinculada: '',
    situacao: '',
    fundamentacao: '',
    comentariosCalculistas: ''
  });

  // Estado de validação para mostrar erros
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estado de carregamento durante salvamento
  const [isSaving, setIsSaving] = useState(false);

  // Estados para o modal de texto expandido
  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    field: '',
    title: '',
    content: ''
  });

  // Estado para gerenciamento de renomeação de tipo
  const [isRenamingTipo, setIsRenamingTipo] = useState(false);
  const [newTipoName, setNewTipoName] = useState('');

  /**
   * Filtra decisões do processo da verba e formata para dropdown
   * Memoizado para performance
   */
  const decisionOptions = useMemo(() => {
    const processDecisions = decisions.filter(d => d.processId === verba.processId);
    return processDecisions.map(d => `${d.idDecisao} - ${d.tipoDecisao}`);
  }, [decisions, verba.processId]);

  /**
   * Effect para carregar dados do lançamento quando o modal abrir
   * Popula o formulário com os dados existentes
   */
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
    }
  }, [lancamento, verba, isOpen]);

  /**
   * Valida se todos os campos obrigatórios estão preenchidos
   * Usa validação simplificada para lançamentos
   */
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

  /**
   * Lida com mudanças nos campos do formulário
   * Remove erros quando o usuário começar a digitar
   */
  const handleInputChange = useCallback((field: keyof NewVerbaLancamento, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Remove erro do campo quando o usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  /**
   * Handler para iniciar o processo de renomeação de tipo
   */
  const handleStartRenameTipo = useCallback(() => {
    setIsRenamingTipo(true);
    setNewTipoName(verba.tipoVerba);
  }, [verba.tipoVerba]);

  /**
   * Handler para cancelar renomeação de tipo
   */
  const handleCancelRenameTipo = useCallback(() => {
    setIsRenamingTipo(false);
    setNewTipoName('');
  }, []);

  /**
   * Handler para executar renomeação de tipo
   */
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

  /**
   * Processa o salvamento das alterações
   * Valida o formulário e chama o callback de salvamento
   */
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

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  /**
   * Handler para abrir modal de texto expandido
   */
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
    handleInputChange(expandedTextModal.field as keyof NewVerbaLancamento, content);
    handleCloseExpandedModal();
  }, [expandedTextModal.field, handleInputChange, handleCloseExpandedModal]);

  /**
   * Lida com teclas pressionadas no modal
   * Escape: fecha o modal, Enter: salva (se não estiver em textarea)
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && e.target !== document.querySelector('textarea')) {
      e.preventDefault();
      handleSave();
    }
  }, [handleClose, handleSave]);

  // Não renderiza nada se o modal não estiver aberto
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop do modal */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />

      {/* Container do modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-4xl max-h-screen overflow-y-auto"
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Cabeçalho do modal */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                {/* Título dinâmico baseado no modo */}
                <h2 className="text-xl font-semibold text-gray-900">
                  {isRenamingTipo ? 'Renomear Tipo de Verba' : 'Editar Lançamento'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {isRenamingTipo ? (
                    <>Renomeando tipo de verba para todas as verbas deste processo</>
                  ) : (
                    <>
                      Verba: <span className="font-medium">{verba.tipoVerba}</span> • 
                      Lançamento: <span className="font-medium">{lancamento.decisaoVinculada}</span>
                    </>
                  )}
                </p>
              </div>
              
              {/* Botão de fechar */}
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title="Fechar modal"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
          </div>

          {/* Conteúdo do modal */}
          <div className="p-6">
            {/* Interface de Renomeação de Tipo */}
            {isRenamingTipo ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-base font-medium text-blue-900 mb-2">
                    Renomear Tipo de Verba
                  </h3>
                  <p className="text-sm text-blue-800 mb-4">
                    Esta operação renomeará o tipo "{verba.tipoVerba}" em todas as verbas deste processo.
                  </p>
                  
                  <div className="space-y-3">
                    {/* Campo para novo nome */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Novo Nome do Tipo
                      </label>
                      <input
                        type="text"
                        value={newTipoName}
                        onChange={(e) => setNewTipoName(e.target.value)}
                        placeholder="Digite o novo nome..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={100}
                      />
                    </div>
                    
                    {/* Botões da renomeação */}
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={handleCancelRenameTipo}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleExecuteRenameTipo}
                        disabled={isSaving || !newTipoName.trim() || newTipoName.trim() === verba.tipoVerba}
                        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                      >
                        {isSaving ? (
                          <>
                            <span className="animate-spin text-xs">⟳</span>
                            <span>Renomeando...</span>
                          </>
                        ) : (
                          <>
                            <Edit2 size={14} />
                            <span>Renomear Tipo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Interface normal de edição de lançamento */
              <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Decisão Vinculada */}
                <CustomDropdown
                  label="Decisão Vinculada"
                  placeholder="-- Selecione uma decisão --"
                  value={formData.decisaoVinculada}
                  options={decisionOptions}
                  required={true}
                  error={errors.decisaoVinculada}
                  onChange={(value) => handleInputChange('decisaoVinculada', value)}
                />

                {/* Situação */}
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

              {/* Fundamentação */}
              <RichTextEditor
                label="Fundamentação"
                placeholder="Fundamentação jurídica da decisão..."
                value={formData.fundamentacao || ''}
                onChange={(value) => handleInputChange('fundamentacao', value)}
                rows={4}
                onExpand={() => handleExpandText('fundamentacao', 'Fundamentação')}
                fieldType="fundamentacao"
              />

              {/* Comentários */}
              <RichTextEditor
                label="Comentários"
                placeholder="Observações e comentários técnicos..."
                value={formData.comentariosCalculistas || ''}
                onChange={(value) => handleInputChange('comentariosCalculistas', value)}
                rows={4}
                onExpand={() => handleExpandText('comentariosCalculistas', 'Comentários')}
                fieldType="comentariosCalculistas"
              />
            </div>
            )}

            {/* Informações de auditoria */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">ID do Lançamento:</span>
                  <span className="ml-2 font-mono">{lancamento.id}</span>
                </div>
                <div>
                  <span className="font-medium">Criado em:</span>
                  <span className="ml-2">{lancamento.dataCriacao.toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="font-medium">ID da Verba:</span>
                  <span className="ml-2 font-mono">{verba.id}</span>
                </div>
                <div>
                  <span className="font-medium">Verba criada em:</span>
                  <span className="ml-2">{verba.dataCriacao.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé do modal com botões de ação */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex justify-end space-x-3">
              {/* Botão Cancelar */}
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Cancelar
              </button>

              {/* Botão Salvar */}
              <button
                onClick={handleSave}
                disabled={isSaving || isRenamingTipo}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin text-xs">⟳</span>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
            ? 'Fundamentação jurídica da decisão...'
            : 'Observações e comentários técnicos...'
        }
      />
    </>
  );
};

export default VerbaEditModal;