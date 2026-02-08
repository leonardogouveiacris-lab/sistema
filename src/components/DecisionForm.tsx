import React, { useState, useCallback } from 'react';
import { NewDecision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { useDynamicEnums } from '../hooks/useDynamicEnums';
import { Save, Plus } from 'lucide-react';

/**
 * Componente DecisionForm - Formulário para cadastro de novas decisões judiciais
 * Permite criar uma nova decisão vinculada a um processo específico
 */
interface DecisionFormProps {
  processId: string;                           // ID do processo ao qual a decisão será vinculada
  processNumber: string;                       // Número do processo para exibição
  onSaveDecision: (decision: NewDecision) => void;
}

const DecisionForm: React.FC<DecisionFormProps> = ({ processId, processNumber, onSaveDecision }) => {
  // Hook para valores dinâmicos de enums
  const { refreshEnumValues } = useDynamicEnums();

  // Estado do formulário com todos os campos da decisão
  const [formData, setFormData] = useState<NewDecision>({
    tipoDecisao: '',
    idDecisao: '',
    situacao: '',
    observacoes: '',
    processId // Adiciona automaticamente o ID do processo
  });

  // Estado de validação para exibir erros
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estados para o modal de texto expandido
  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    title: '',
    content: ''
  });

  /**
   * Valida se todos os campos obrigatórios estão preenchidos
   * Retorna true se válido, false caso contrário
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validação do tipo de decisão
    if (!formData.tipoDecisao.trim()) {
      newErrors.tipoDecisao = 'Tipo de decisão é obrigatório';
    }

    // Validação do ID da decisão
    if (!formData.idDecisao.trim()) {
      newErrors.idDecisao = 'ID da decisão é obrigatório';
    }

    // Validação da situação
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
   * Processa o salvamento da decisão
   * Valida o formulário e salva a decisão vinculada ao processo
   */
  const handleSaveDecision = () => {
    if (validateForm()) {
      // Garante que o processId está sempre presente na decisão
      const decisionWithProcessId = {
        ...formData,
        processId
      };
      
      onSaveDecision(decisionWithProcessId);
      resetForm();
    }
  };

  /**
   * Limpa todos os campos do formulário
   * Volta ao estado inicial mantendo o processId
   */
  const resetForm = () => {
    setFormData({
      tipoDecisao: '',
      idDecisao: '',
      situacao: '',
      observacoes: '',
      processId // Mantém o processId após reset
    });
    setErrors({});
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
  }, [handleInputChange, handleCloseExpandedModal]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* Cabeçalho do formulário */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Decisões do Processo</h2>
        <p className="text-sm text-gray-600 mt-1">
          Registre as decisões judiciais do processo <span className="font-medium">{processNumber}</span>
        </p>
      </div>

      {/* Seção Nova Decisão */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Plus size={14} className="text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Nova Decisão</h3>
        </div>

        {/* Formulário */}
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
              processId={processId}
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
              processId={processId}
              onChange={(value) => handleInputChange('situacao', value)}
              allowCustomValues={true}
              onValueCreated={() => refreshEnumValues(DynamicEnumType.SITUACAO_DECISAO)}
            />
          </div>

          {/* Comentários */}
          <RichTextEditor
            label="Comentarios"
            placeholder="Comentarios sobre a decisao..."
            value={formData.observacoes}
            onChange={(value) => handleInputChange('observacoes', value)}
            rows={4}
            onExpand={handleExpandText}
          />

          {/* Botão de salvamento */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleSaveDecision}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Save size={16} />
              <span>Salvar Decisão</span>
            </button>
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
        placeholder="Comentarios sobre a decisao..."
      />
    </div>
  );
};

export default DecisionForm;