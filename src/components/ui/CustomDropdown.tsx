/**
 * Componente CustomDropdown otimizado
 * Dropdown reutilizavel com melhor performance e acessibilidade
 * Suporta valores dinamicos com carregamento automatico por processo
 * Valores customizados sao visiveis apenas no processo que os criou
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDynamicEnums } from '../../hooks/useDynamicEnums';
import { DynamicEnumType } from '../../services/dynamicEnum.service';
import logger from '../../utils/logger';

interface CustomDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options?: readonly string[];
  required?: boolean;
  error?: string;
  disabled?: boolean;
  enumType?: DynamicEnumType;
  processId?: string;
  onChange: (value: string) => void;
  allowCustomValues?: boolean;
  onValueCreated?: () => void | Promise<void>;
}

/**
 * Componente CustomDropdown com funcionalidades avancadas
 * Carrega valores combinados automaticamente (predefinidos + customizados do processo)
 */
const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  placeholder,
  value,
  options,
  required = false,
  error,
  disabled = false,
  enumType,
  processId,
  onChange,
  allowCustomValues = false,
  onValueCreated
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [customInput, setCustomInput] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [combinedOptions, setCombinedOptions] = useState<readonly string[]>(options || []);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { addCustomValue, getCombinedValues, getValuesFromDatabase } = useDynamicEnums();

  useEffect(() => {
    if (!enumType) {
      setCombinedOptions(options || []);
      return;
    }

    let isMounted = true;

    const loadCombinedValues = async () => {
      setIsLoadingOptions(true);
      try {
        let result;
        if (options && options.length > 0) {
          result = await getCombinedValues(enumType, options, processId);
        } else {
          result = await getValuesFromDatabase(enumType, processId);
        }
        if (isMounted) {
          setCombinedOptions(result.all);
        }
      } catch (err) {
        logger.error(`Erro ao carregar valores combinados: ${err}`, 'CustomDropdown.loadCombinedValues');
        if (isMounted) {
          setCombinedOptions(options || []);
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    };

    loadCombinedValues();

    return () => {
      isMounted = false;
    };
  }, [enumType, processId, options, getCombinedValues, getValuesFromDatabase]);

  const filteredOptions = useMemo(() => {
    if (!allowCustomValues || !customInput.trim()) {
      return combinedOptions;
    }

    const searchTerm = customInput.toLowerCase().trim();
    return combinedOptions.filter(opt =>
      opt.toLowerCase().includes(searchTerm)
    );
  }, [combinedOptions, customInput, allowCustomValues]);

  const isNewValue = useMemo(() => {
    if (!allowCustomValues || !customInput.trim()) return false;

    const normalizedInput = customInput.trim();
    return !combinedOptions.some(opt =>
      opt.toLowerCase() === normalizedInput.toLowerCase()
    );
  }, [customInput, combinedOptions, allowCustomValues]);

  /**
   * Classes CSS do container principal
   * Memoizadas para evitar recalculo
   */
  const containerClasses = useMemo(() => {
    const baseClasses = 'relative w-full border rounded-md focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-200';
    const errorClasses = error ? 'border-red-500 focus-within:ring-red-500' : 'border-gray-300';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
    
    return `${baseClasses} ${errorClasses} ${disabledClasses}`.trim();
  }, [error, disabled]);

  const isDisabled = disabled || isLoadingOptions;

  const buttonClasses = useMemo(() => {
    const baseClasses = 'w-full px-3 py-2 text-left bg-white focus:outline-none transition-colors duration-200';
    const stateClasses = isOpen ? 'bg-gray-50' : 'hover:bg-gray-50';
    const disabledClasses = isDisabled ? 'cursor-not-allowed' : 'cursor-pointer';

    return `${baseClasses} ${stateClasses} ${disabledClasses}`.trim();
  }, [isOpen, isDisabled]);

  /**
   * Sincroniza valor interno com prop externa
   */
  useEffect(() => {
    setInputValue(value);
    setCustomInput('');
  }, [value]);

  /**
   * Gerencia cliques fora do componente
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setCustomInput('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  /**
   * Foca no input quando dropdown abre em modo de entrada customizada
   */
  useEffect(() => {
    if (isOpen && allowCustomValues && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, allowCustomValues]);

  const handleOpen = useCallback(() => {
    if (isDisabled) return;
    setIsOpen(true);
  }, [isDisabled]);

  /**
   * Fecha o dropdown
   */
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setCustomInput('');
  }, []);

  /**
   * Seleciona uma opção da lista
   *
   * @param option - Opção selecionada pelo usuário
   */
  const handleSelectOption = useCallback((option: string) => {
    setInputValue(option);
    onChange(option);
    setCustomInput('');
    setIsOpen(false);
  }, [onChange]);

  /**
   * Manipula mudança no input de entrada customizada
   */
  const handleCustomInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomInput(e.target.value);
  }, []);

  const reloadCombinedValues = useCallback(async () => {
    if (!enumType) return;
    try {
      let result;
      if (options && options.length > 0) {
        result = await getCombinedValues(enumType, options, processId);
      } else {
        result = await getValuesFromDatabase(enumType, processId);
      }
      setCombinedOptions(result.all);
    } catch (err) {
      logger.error(`Erro ao recarregar valores: ${err}`, 'CustomDropdown.reloadCombinedValues');
    }
  }, [enumType, options, processId, getCombinedValues, getValuesFromDatabase]);

  const handleCreateCustomValue = useCallback(async () => {
    if (!customInput.trim() || !allowCustomValues || isCreatingCustom || !enumType) return;

    const newValue = customInput.trim();
    setIsCreatingCustom(true);

    try {
      logger.info(`Criando novo valor customizado: "${newValue}" para ${enumType}`, 'CustomDropdown.handleCreateCustomValue');

      const result = await addCustomValue(enumType, newValue, processId);

      if (result.success) {
        logger.success(`Valor criado com sucesso: "${result.normalizedValue}"`, 'CustomDropdown.handleCreateCustomValue');

        setInputValue(result.normalizedValue);
        onChange(result.normalizedValue);
        setCustomInput('');
        setIsOpen(false);

        await reloadCombinedValues();

        if (onValueCreated) {
          try {
            await Promise.resolve(onValueCreated());
          } catch (callbackError) {
            logger.error(`Erro ao executar callback onValueCreated: ${callbackError}`, 'CustomDropdown.handleCreateCustomValue');
          }
        }
      } else {
        logger.error(`Falha ao criar valor: ${result.message}`, 'CustomDropdown.handleCreateCustomValue');
      }
    } catch (error) {
      logger.errorWithException(
        'Erro ao criar valor customizado',
        error as Error,
        'CustomDropdown.handleCreateCustomValue'
      );
    } finally {
      setIsCreatingCustom(false);
    }
  }, [customInput, allowCustomValues, isCreatingCustom, enumType, addCustomValue, processId, onChange, onValueCreated, reloadCombinedValues]);

  /**
   * Lida com teclas pressionadas no botão
   * Simplificado apenas para navegação do dropdown
   */
  const handleButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleOpen();
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          setCustomInput('');
        }
        break;
    }
  }, [handleOpen, isOpen]);

  /**
   * Lida com teclas pressionadas no input customizado
   */
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isNewValue && customInput.trim()) {
      e.preventDefault();
      handleCreateCustomValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCustomInput('');
      setIsOpen(false);
    }
  }, [isNewValue, customInput, handleCreateCustomValue]);

  return (
    <div>
      {/* Label do campo */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Container principal do dropdown */}
      <div ref={dropdownRef} className={containerClasses}>
        <button
          type="button"
          onClick={handleOpen}
          onKeyDown={handleButtonKeyDown}
          disabled={isDisabled}
          className={buttonClasses}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`${label}, valor atual: ${value || 'nenhum'}`}
        >
          <div className="flex items-center justify-between">
            <span className={value ? 'text-gray-900' : 'text-gray-500'}>
              {isLoadingOptions ? 'Carregando...' : (value || placeholder)}
            </span>
            <span
              className={`text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            >
              ▼
            </span>
          </div>
        </button>

        {isOpen && !isDisabled && (
          <div
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col"
            role="listbox"
            aria-label={`Opções para ${label}`}
          >
            {/* Input de busca/criação customizada */}
            {allowCustomValues && (
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <input
                  ref={inputRef}
                  type="text"
                  value={customInput}
                  onChange={handleCustomInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Digite para buscar ou criar novo..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Botão para criar novo valor */}
                {isNewValue && customInput.trim() && (
                  <button
                    type="button"
                    onClick={handleCreateCustomValue}
                    disabled={isCreatingCustom}
                    className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded transition-colors flex items-center justify-center space-x-2"
                  >
                    {isCreatingCustom ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Criando...</span>
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        <span>Criar "{customInput.trim()}"</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Lista de opções disponíveis */}
            <div className="overflow-y-auto max-h-60">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className={`
                      w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm
                      ${value === option ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-900'}
                    `}
                    role="option"
                    aria-selected={value === option}
                  >
                    {option}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500 text-center text-sm" role="option">
                  {allowCustomValues && customInput.trim()
                    ? 'Nenhuma opção encontrada. Use o botão acima para criar.'
                    : 'Nenhuma opção encontrada'
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mensagem de erro */}
      {error && (
        <p className="text-red-500 text-xs mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default React.memo(CustomDropdown);