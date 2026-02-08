import React, { useState, useEffect, useCallback } from 'react';
import { Decision, NewDecision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { useDynamicEnums } from '../hooks/useDynamicEnums';
import logger from '../utils/logger';
import { Save } from 'lucide-react';

/**
 * Componente DecisionEditModal - Modal para edição de decisões existentes
 * 
 * Funcionalidades:
 * - Carrega dados da decisão selecionada
 * - Permite editar todos os campos
 * - Validação de campos obrigatórios
 * - Modal responsivo com backdrop
 * - Integração com o design system
 */
interface DecisionEditModalProps {
  decision: Decision | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<NewDecision>) => Promise<void> | void;
}

const DecisionEditModal: React.FC<DecisionEditModalProps> = ({
  decision,
  isOpen,
  onClose,
  onSave
}) => {
  // Hook para valores dinâmicos de enums
  const { refreshEnumValues } = useDynamicEnums();

  // Estado do formulário de edição
  const [formData, setFormData] = useState<NewDecision>({
    tipoDecisao: '',
    idDecisao: '',
    situacao: '',
    observacoes: ''
  });

  // Estado de validação para mostrar erros
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estado de carregamento durante salvamento
  const [isSaving, setIsSaving] = useState(false);

  // Estados para o modal de texto expandido
  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    title: '',
    content: ''
  });

  /**
   * Effect para carregar dados da decisão quando o modal abrir
   * Popula o formulário com os dados existentes
   */
  useEffect(() => {
    if (decision && isOpen) {
      setFormData({
        tipoDecisao: decision.tipoDecisao,
        idDecisao: decision.idDecisao,
        situacao: decision.situacao,
        observacoes: decision.observacoes || ''
      });
      setErrors({}); // Limpa erros ao carregar nova decisão
      
      logger.info(
        `Modal de edição aberto para decisão: ${decision.idDecisao}`,
        'DecisionEditModal - useEffect',
        { decisionId: decision.id, tipo: decision.tipoDecisao }
      );
    }
  }, [decision, isOpen]);

  /**
   * Valida se todos os campos obrigatórios estão preenchidos
   * Retorna true se válido, false caso contrário
   */
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Lida com mudanças nos campos do formulário
   * Remove erros quando o usuário começar a digitar
   */
  const handleInputChange = (field: keyof NewDecision, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Remove erro do campo quando o usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /**
   * Processa o salvamento das alterações
   * Valida o formulário e chama o callback de salvamento
   */
  const handleSave = async () => {
    if (!decision) return;

    if (validateForm()) {
      setIsSaving(true);
      
      try {
        await onSave(decision.id, formData);
        logger.success(
          `Decisão "${formData.idDecisao}" editada com sucesso`,
          'DecisionEditModal - handleSave',
          { decisionId: decision.id }
        );
      } catch (error) {
        logger.errorWithException(
          'Falha ao salvar alterações na decisão',
          error as Error,
          'DecisionEditModal - handleSave',
          { decisionId: decision.id, formData }
        );
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleClose = () => {
    if (!decision) {
      onClose();
      return;
    }

    logger.info(
      'Modal de edição fechado',
      'DecisionEditModal - handleClose',
      { decisionId: decision?.id }
    );

    onClose();
  };

  /**
   * Handler para abrir modal de texto expandido
   */
  const handleExpandText = useCallback(() => {
    setExpandedTextModal({
      isOpen: true,
      title: 'Observações da Decisão',
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

  /**
   * Lida com teclas pressionadas no modal
   * Escape: fecha o modal, Enter: salva (se não estiver no editor)
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Não renderiza nada se o modal não estiver aberto
  if (!isOpen || !decision) {
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
          className="bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-2xl max-h-screen overflow-y-auto"
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Cabeçalho do modal */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Editar Decisão</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Modifique as informações da decisão "{decision.idDecisao}"
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
            <div className="space-y-4">
              {/* Primeira linha: Tipo, ID e Situação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tipo de Decisão */}
                <CustomDropdown
                  label="Tipo de Decisão"
                  placeholder="Selecione ou crie novo..."
                  value={formData.tipoDecisao}
                  required={true}
                  error={errors.tipoDecisao}
                  enumType={DynamicEnumType.TIPO_DECISAO}
                  processId={decision.processId}
                  onChange={(value) => handleInputChange('tipoDecisao', value)}
                  allowCustomValues={true}
                  onValueCreated={() => refreshEnumValues(DynamicEnumType.TIPO_DECISAO)}
                />

                {/* ID da Decisão */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID da Decisão *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SEN-001, AC-002"
                    value={formData.idDecisao}
                    onChange={(e) => handleInputChange('idDecisao', e.target.value)}
                    className={`
                      w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${errors.idDecisao ? 'border-red-500' : 'border-gray-300'}
                    `}
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
                  processId={decision.processId}
                  onChange={(value) => handleInputChange('situacao', value)}
                  allowCustomValues={true}
                  onValueCreated={() => refreshEnumValues(DynamicEnumType.SITUACAO_DECISAO)}
                />
              </div>

              {/* Observações */}
              <RichTextEditor
                label="Observações"
                placeholder="Observações sobre a decisão..."
                value={formData.observacoes}
                onChange={(value) => handleInputChange('observacoes', value)}
                rows={4}
                onExpand={handleExpandText}
              />
            </div>

            {/* Informações de auditoria */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">ID do Sistema:</span>
                  <span className="ml-2 font-mono">{decision.id}</span>
                </div>
                <div>
                  <span className="font-medium">Criado em:</span>
                  <span className="ml-2">{decision.dataCriacao.toLocaleString('pt-BR')}</span>
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
                disabled={isSaving}
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
        placeholder="Observações sobre a decisão..."
      />
    </>
  );
};

export default DecisionEditModal;