/**
 * Componente VerbaForm - Formulário para cadastro de verbas trabalhistas
 * Permite criar uma nova verba vinculada a um processo e decisão específicos
 */

import React, { useState, useCallback, useMemo } from 'react';
import { NewVerbaComLancamento } from '../types/Verba';
import { Decision } from '../types/Decision';
import { CustomDropdown, RichTextEditor, ExpandedTextModal } from './ui';
import { DynamicEnumType } from '../services/dynamicEnum.service';
import { ValidationUtils } from '../utils';
import { useTipoVerbas } from '../hooks/useTipoVerbas';
import logger from '../utils/logger';
import { Save, Plus } from 'lucide-react';

/**
 * Props do componente VerbaForm
 */
interface VerbaFormProps {
  processId: string;                        // ID do processo ao qual a verba será vinculada
  decisions: Decision[];                    // Decisões disponíveis para vincular
  onSaveVerba: (verba: NewVerbaComLancamento) => boolean; // Callback para salvar nova verba com lançamento
  isLoading?: boolean;
  refreshTrigger?: number;                  // Trigger para forçar refresh dos tipos
}

/**
 * Componente VerbaForm
 */
const VerbaForm: React.FC<VerbaFormProps> = ({ 
  processId, 
  decisions, 
  onSaveVerba, 
  isLoading = false,
  refreshTrigger = 0
}) => {
  // Hook simplificado para tipos de verba - agora contextualizado por processo
  const {
    tipos: tiposDisponiveis,
    isLoading: isTiposLoading,
    error: tiposError,
    carregarTipos,
    criarTipo,
    validarTipo,
    forcarRecarregamento
  } = useTipoVerbas(processId); // Passa processId diretamente para o hook

  /**
   * Estado inicial do formulário memoizado (estrutura hierárquica)
   */
  const initialFormData = useMemo((): NewVerbaComLancamento => ({
    tipoVerba: '',
    processId, // Adiciona automaticamente o ID do processo
    lancamento: {
      decisaoVinculada: '',
      situacao: '',
      fundamentacao: '',
      comentariosCalculistas: ''
    }
  }), [processId]);

  // Estados do componente
  const [formData, setFormData] = useState<NewVerbaComLancamento>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Estados para o modal de texto expandido
  const [expandedTextModal, setExpandedTextModal] = useState({
    isOpen: false,
    field: '',
    title: '',
    content: ''
  });

  /**
   * Effect para recarregar tipos quando refreshTrigger muda (após rename)
   * O carregamento inicial agora é feito automaticamente pelo hook contextualizado
   */
  React.useEffect(() => {
    if (refreshTrigger > 0) {
      logger.info(
        `RefreshTrigger ativado (${refreshTrigger}), recarregando tipos para processo: ${processId}`,
        'VerbaForm - refreshTrigger',
        { processId, refreshTrigger }
      );
      
      carregarTipos(processId);
    }
  }, [refreshTrigger, carregarTipos, processId]);

  /**
   * Filtra decisões do processo atual e formata para dropdown
   */
  const decisionOptions = useMemo(() => {
    const processDecisions = decisions.filter(d => d.processId === processId);
    return processDecisions.map(d => `${d.idDecisao} - ${d.tipoDecisao}`);
  }, [decisions, processId]);

  /**
   * Valida formulário usando utilitário centralizado para estrutura hierárquica
   */
  const validateForm = useCallback((): boolean => {
    const validation = ValidationUtils.validateNewVerbaComLancamento(formData);
    setErrors(validation.errors);
    return validation.isValid;
  }, [formData]);

  /**
   * Handler otimizado para mudanças nos inputs
   * Suporta campos aninhados da estrutura hierárquica
   * Agora com validação dinâmica para tipos de verba
   */
  const handleInputChange = useCallback((field: string, value: string) => {
    if (field === 'tipoVerba') {
      // Validação em tempo real usando hook simplificado
      const validation = validarTipo(value);
      if (!validation.isValid && value.trim()) {
        setErrors(prev => ({ ...prev, tipoVerba: validation.errorMessage || 'Tipo inválido' }));
      } else {
        // Remove erro se validação passou
        setErrors(prev => ({ ...prev, tipoVerba: '' }));
      }
      
      setFormData(prev => ({ ...prev, tipoVerba: value }));
    } else {
      // Campos do lançamento
      setFormData(prev => ({
        ...prev,
        lancamento: { ...prev.lancamento, [field]: value }
      }));
    }
    
    // Remove erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors, validarTipo]);

  /**
   * Handler otimizado para salvar verba
   * Agora com criação automática de tipos personalizados
   */
  const handleSaveVerba = useCallback(async () => {
    // Validação do formulário
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const success = onSaveVerba(formData);
      if (success) {
        // Recarrega tipos após criar verba
        await carregarTipos(processId);
        setFormData(initialFormData);
        setErrors({});
      }
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, onSaveVerba, initialFormData, carregarTipos, processId]);

  /**
   * Handler para abrir modal de texto expandido
   * Mapeia corretamente os campos e conteúdo para o modal
   */
  const handleExpandText = useCallback((field: string, title: string) => {
    // Determina o conteúdo baseado no campo
    let content = '';
    let mappedField = field;
    
    if (field === 'fundamentacao') {
      content = formData.lancamento.fundamentacao || '';
      mappedField = 'fundamentacao';
    } else if (field === 'comentariosCalculistas') {
      content = formData.lancamento.comentariosCalculistas || '';
      mappedField = 'comentarios'; // Mapeia para o nome usado na normalização
    }

    setExpandedTextModal({
      isOpen: true,
      field: mappedField,
      title,
      content
    });
    
    logger.info(
      `Modal expandido aberto para campo: ${field}`,
      'VerbaForm - handleExpandText',
      { originalField: field, mappedField, contentLength: content.length }
    );
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
   * Salva no campo correto baseado no mapeamento
   */
  const handleSaveExpandedText = useCallback((content: string) => {
    // Mapeia de volta o campo para o nome original
    const originalField = expandedTextModal.field === 'comentarios' 
      ? 'comentariosCalculistas' 
      : expandedTextModal.field as 'fundamentacao' | 'comentariosCalculistas';
    
    handleInputChange(originalField, content);
    handleCloseExpandedModal();
    
    logger.success(
      `Conteúdo salvo do modal expandido para campo: ${originalField}`,
      'VerbaForm - handleSaveExpandedText',
      { field: expandedTextModal.field, originalField, contentLength: content.length }
    );
  }, [expandedTextModal.field, handleInputChange, handleCloseExpandedModal]);

  /**
   * Handler otimizado para reset do formulário
   */
  const handleReset = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
  }, [initialFormData]);

  /**
   * Handler para teclas pressionadas
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveVerba();
    }
  }, [handleSaveVerba]);

  // Se o sistema está carregando
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
      {/* Cabeçalho */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Cadastro de Verbas</h2>
        <p className="text-sm text-gray-600 mt-1">
          Registre as verbas trabalhistas e suas situações
        </p>
      </div>

      {/* Seção Nova Verba */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Plus size={14} className="text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Nova Verba</h3>
        </div>

        {/* Formulário */}
        <form onSubmit={(e) => { e.preventDefault(); handleSaveVerba(); }} onKeyDown={handleKeyDown}>
          <div className="space-y-4">
            {/* Primeira linha: Tipo de Verba e Decisão Vinculada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Verba */}
              {/* Novo dropdown dinâmico para tipos de verba */}
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

              {/* Decisão Vinculada */}
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

            {/* Segunda linha: Situação */}
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

            {/* Fundamentação */}
            <RichTextEditor
              label="Fundamentação"
              placeholder="Fundamentação jurídica da decisão..."
              value={formData.lancamento.fundamentacao || ''}
              onChange={(value) => handleInputChange('fundamentacao', value)}
              rows={4}
              onExpand={() => handleExpandText('fundamentacao', 'Fundamentação')}
              fieldType="fundamentacao"
            />

            {/* Comentários */}
            <RichTextEditor
              label="Comentários"
              placeholder="Observações e comentários técnicos..."
              value={formData.lancamento.comentariosCalculistas || ''}
              onChange={(value) => handleInputChange('comentariosCalculistas', value)}
              rows={4}
              onExpand={() => handleExpandText('comentariosCalculistas', 'Comentários')}
              fieldType="comentariosCalculistas"
            />

            {/* Botão de salvamento */}
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

export default React.memo(VerbaForm);