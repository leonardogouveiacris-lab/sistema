/**
 * Componente ProcessForm otimizado
 * 
 * Formulário completo para cadastro de novos processos.
 * Inclui validação em tempo real, tratamento de erros e funcionalidades
 * de backup/importação com interface intuitiva e acessível.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { NewProcess } from '../types/Process';
import { ValidationUtils, getUserFriendlyMessage } from '../utils';
import { LoadingSpinner } from './ui';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
import logger from '../utils/logger';
import { Save, Upload, RotateCcw, CheckCircle, XCircle } from 'lucide-react';

/**
 * Interface para as props do componente ProcessForm
 */
interface ProcessFormProps {
  onSaveProcess: (process: NewProcess) => Promise<boolean>;  // Callback assíncrono para salvar
  onImportBackup: () => void;                               // Callback para importar backup
  isLoading?: boolean;                                      // Estado de carregamento global
}

/**
 * Componente ProcessForm - Formulário de cadastro de processos
 */
const ProcessForm: React.FC<ProcessFormProps> = ({ 
  onSaveProcess, 
  onImportBackup,
  isLoading = false
}) => {
  /**
   * Estado inicial do formulário memoizado
   * Memoizado para evitar recriação desnecessária do objeto
   */
  const initialFormData = useMemo((): NewProcess => ({
    numeroProcesso: '',
    reclamante: '',
    reclamada: '',
    observacoesGerais: ''
  }), []);

  // Estados principais do componente
  const [formData, setFormData] = useState<NewProcess>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [generalError, setGeneralError] = useState<string>('');

  /**
   * Valida formulário usando utilitário centralizado
   * 
   * Utiliza o sistema centralizado de validação para garantir
   * consistência em toda a aplicação
   * 
   * @returns boolean - true se todos os dados são válidos
   */
  const validateForm = useCallback((): boolean => {
    const validation = ValidationUtils.validateNewProcess(formData);
    setErrors(validation.errors);
    
    if (!validation.isValid) {
      logger.warn('Formulário de processo inválido', 'ProcessForm', { errors: validation.errors });
    }
    
    return validation.isValid;
  }, [formData]);

  /**
   * Handler otimizado para mudanças nos inputs
   * 
   * Remove erros em tempo real quando o usuário corrige os dados
   * e limpa mensagens de status para melhor UX
   */
  const handleInputChange = useCallback((field: keyof NewProcess, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpa erro do campo específico quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Limpa mensagens de status quando há mudanças
    if (successMessage) setSuccessMessage('');
    if (generalError) setGeneralError('');
  }, [errors, successMessage, generalError]);

  /**
   * Handler assíncrono para salvar processo
   * 
   * Valida os dados, executa o salvamento e trata o resultado
   * com feedback visual apropriado para o usuário
   */
  const handleSaveProcess = useCallback(async () => {
    // Limpa mensagens anteriores
    setSuccessMessage('');
    setGeneralError('');
    
    if (!validateForm()) {
      setGeneralError('Por favor, corrija os erros no formulário');
      return;
    }

    setIsSaving(true);
    
    try {
      logger.info('Iniciando salvamento de processo', 'ProcessForm', { 
        numeroProcesso: formData.numeroProcesso,
        reclamante: formData.reclamante
      });
      
      const success = await onSaveProcess(formData);
      
      if (success) {
        // Limpa o formulário e mostra mensagem de sucesso
        setFormData(initialFormData);
        setErrors({});
        setSuccessMessage(SUCCESS_MESSAGES.SAVE_SUCCESS('Processo'));
        
        logger.success('Processo salvo com sucesso via formulário', 'ProcessForm', {
          numeroProcesso: formData.numeroProcesso
        });
      }
    } catch (error) {
      const friendlyMessage = getUserFriendlyMessage(error);
      setGeneralError(friendlyMessage);
      
      logger.errorWithException(
        'Erro ao salvar processo via formulário',
        error as Error,
        'ProcessForm'
      );
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, onSaveProcess, initialFormData]);

  /**
   * Handler para reset/limpeza do formulário
   * 
   * Restaura o formulário ao estado inicial e limpa todas
   * as mensagens de erro e sucesso
   */
  const handleReset = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setSuccessMessage('');
    setGeneralError('');
    
    logger.info('Formulário de processo resetado', 'ProcessForm');
  }, [initialFormData]);

  /**
   * Handler para atalhos de teclado
   * 
   * Ctrl+Enter: salva o formulário
   * Escape: limpa o formulário
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveProcess();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleReset();
    }
  }, [handleSaveProcess, handleReset]);

  /**
   * Gera classes CSS para inputs baseado no estado de erro
   * 
   * Aplica estilos condicionais baseados no estado de validação
   * para feedback visual imediato ao usuário
   */
  const getInputClasses = useCallback((fieldName: string): string => {
    const baseClasses = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    const focusClasses = 'focus:ring-blue-500';
    const errorClasses = errors[fieldName] ? 'border-red-500 focus:ring-red-500' : 'border-gray-300';
    
    return `${baseClasses} ${focusClasses} ${errorClasses}`;
  }, [errors]);

  /**
   * Renderiza campo de erro se existir
   * 
   * Mostra mensagens de erro específicas para cada campo
   * com ARIA labels para acessibilidade
   */
  const renderFieldError = useCallback((fieldName: string) => {
    if (!errors[fieldName]) return null;
    
    return (
      <p id={`${fieldName}-error`} className="text-red-500 text-xs mt-1" role="alert">
        {errors[fieldName]}
      </p>
    );
  }, [errors]);

  /**
   * Renderiza mensagens de status (sucesso/erro geral)
   * 
   * Mostra feedback visual do resultado das operações
   */
  const renderStatusMessages = useCallback(() => {
    return (
      <>
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4" role="alert">
            <div className="flex items-center">
              <CheckCircle size={14} className="text-green-600 mr-2" />
              <p className="text-green-800 text-sm font-medium">{successMessage}</p>
            </div>
          </div>
        )}
        
        {generalError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4" role="alert">
            <div className="flex items-center">
              <XCircle size={14} className="text-red-600 mr-2" />
              <p className="text-red-800 text-sm font-medium">{generalError}</p>
            </div>
          </div>
        )}
      </>
    );
  }, [successMessage, generalError]);

  // Renderização de loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <LoadingSpinner size="lg" text="Carregando sistema..." />
      </div>
    );
  }

  // Renderização principal do componente
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Cadastro de Processo</h2>
        <p className="text-sm text-gray-600 mt-1">
          Informações básicas do processo
          <span className="ml-2 text-xs text-gray-500">
            (Ctrl+Enter para salvar • Esc para limpar)
          </span>
        </p>
      </div>

      {/* Mensagens de status */}
      {renderStatusMessages()}

      {/* Formulário */}
      <form onSubmit={(e) => { e.preventDefault(); handleSaveProcess(); }} onKeyDown={handleKeyDown}>
        <div className="space-y-4">
          {/* Número do Processo */}
          <div>
            <label htmlFor="numeroProcesso" className="block text-sm font-medium text-gray-700 mb-1">
              Número do Processo *
            </label>
            <input
              id="numeroProcesso"
              type="text"
              placeholder="Ex: 0000000-00.0000.0.00.0000"
              value={formData.numeroProcesso}
              onChange={(e) => handleInputChange('numeroProcesso', e.target.value)}
              className={getInputClasses('numeroProcesso')}
              disabled={isSaving}
              aria-invalid={!!errors.numeroProcesso}
              aria-describedby={errors.numeroProcesso ? 'numeroProcesso-error' : undefined}
              required
            />
            {renderFieldError('numeroProcesso')}
          </div>

          {/* Parte Autora e Parte Ré */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reclamante" className="block text-sm font-medium text-gray-700 mb-1">
                Parte Autora *
              </label>
              <input
                id="reclamante"
                type="text"
                placeholder="Nome da parte autora"
                value={formData.reclamante}
                onChange={(e) => handleInputChange('reclamante', e.target.value)}
                className={getInputClasses('reclamante')}
                disabled={isSaving}
                aria-invalid={!!errors.reclamante}
                aria-describedby={errors.reclamante ? 'reclamante-error' : undefined}
                required
              />
              {renderFieldError('reclamante')}
            </div>

            <div>
              <label htmlFor="reclamada" className="block text-sm font-medium text-gray-700 mb-1">
                Parte Re *
              </label>
              <input
                id="reclamada"
                type="text"
                placeholder="Nome da parte re"
                value={formData.reclamada}
                onChange={(e) => handleInputChange('reclamada', e.target.value)}
                className={getInputClasses('reclamada')}
                disabled={isSaving}
                aria-invalid={!!errors.reclamada}
                aria-describedby={errors.reclamada ? 'reclamada-error' : undefined}
                required
              />
              {renderFieldError('reclamada')}
            </div>
          </div>

          {/* Observações Gerais */}
          <div>
            <label htmlFor="observacoesGerais" className="block text-sm font-medium text-gray-700 mb-1">
              Observações Gerais
            </label>
            <textarea
              id="observacoesGerais"
              rows={4}
              placeholder="Observações adicionais sobre o processo..."
              value={formData.observacoesGerais}
              onChange={(e) => handleInputChange('observacoesGerais', e.target.value)}
              className={getInputClasses('observacoesGerais')}
              disabled={isSaving}
              aria-invalid={!!errors.observacoesGerais}
              aria-describedby={errors.observacoesGerais ? 'observacoesGerais-error' : undefined}
            />
            {renderFieldError('observacoesGerais')}
          </div>

          {/* Botões de ação */}
          <div className="flex justify-center space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {isSaving ? (
                <>
                  <LoadingSpinner size="sm" color="gray" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden="true" />
                  <span>Salvar Processo</span>
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={onImportBackup}
              disabled={isSaving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <Upload size={16} aria-hidden="true" />
              <span>Importar Backup</span>
            </button>

            {/* Botão de reset (condicional) */}
            {(formData.numeroProcesso || formData.reclamante || formData.reclamada || formData.observacoesGerais) && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                title="Limpar formulário (Esc)"
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default React.memo(ProcessForm);