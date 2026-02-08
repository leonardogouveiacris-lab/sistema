/**
 * Componente Navigation otimizado
 * Menu de navegação principal com melhor acessibilidade e performance
 */

import React, { useCallback, useMemo } from 'react';
import { Folder, FileText, BarChart3, Lock } from 'lucide-react';

/**
 * Props do componente Navigation
 */
interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasSelectedProcess?: boolean;
  selectedProcessNumber?: string;
}

/**
 * Interface para definição de tabs
 */
interface TabDefinition {
  id: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

/**
 * Componente Navigation
 */
const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  hasSelectedProcess = false,
  selectedProcessNumber
}) => {
  
  /**
   * Define which tabs require a selected process
   */
  const processRequiredTabs = useMemo(() => new Set(['relatorios']), []);

  /**
   * Configuração das tabs memoizada
   */
  const tabs = useMemo<TabDefinition[]>(() => [
    {
      id: 'lista-processos',
      label: 'Lista de Processos',
      icon: <Folder size={16} />,
      ariaLabel: 'Ir para Lista de Processos'
    },
    {
      id: 'processo',
      label: 'Processo',
      icon: <FileText size={16} />,
      ariaLabel: 'Ir para Processo ativo'
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: <BarChart3 size={16} />,
      ariaLabel: 'Ir para Relatórios'
    }
  ], []);

  /**
   * Checks if a tab should be disabled
   * MUST be declared before handleTabClick to avoid "Cannot access before initialization" error
   */
  const isTabDisabled = useCallback((tabId: string): boolean => {
    return processRequiredTabs.has(tabId) && !hasSelectedProcess;
  }, [processRequiredTabs, hasSelectedProcess]);

  /**
   * Handler otimizado para mudança de tab
   */
  const handleTabClick = useCallback((tabId: string) => {
    if (tabId !== activeTab) {
      onTabChange(tabId);
    }
  }, [activeTab, onTabChange]);

  /**
   * Handler para navegação via teclado
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabClick(tabId);
    }
  }, [handleTabClick]);

  /**
   * Gera classes CSS para cada tab
   */
  const getTabClasses = useCallback((isActive: boolean, isDisabled: boolean): string => {
    const baseClasses = 'flex items-center space-x-2 py-4 border-b-2 transition-colors duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t-sm';

    if (isDisabled) {
      return `${baseClasses} border-transparent text-gray-300 cursor-not-allowed opacity-50`;
    }

    return isActive
      ? `${baseClasses} border-blue-600 text-blue-600`
      : `${baseClasses} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer`;
  }, []);

  return (
    <nav className="bg-white border-b border-gray-200" role="navigation" aria-label="Menu principal">
      <div className="container mx-auto max-w-4xl px-6">
        <div className="flex space-x-8 overflow-x-auto" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled = isTabDisabled(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!isDisabled) {
                    handleTabClick(tab.id);
                  }
                }}
                onKeyDown={(e) => !isDisabled && handleKeyDown(e, tab.id)}
                className={getTabClasses(isActive, isDisabled)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                aria-label={tab.ariaLabel}
                aria-disabled={isDisabled}
                tabIndex={isActive ? 0 : -1}
                disabled={isDisabled}
                title={isDisabled ? 'Selecione um processo primeiro' : undefined}
              >
                <span aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="text-sm font-medium">
                  {tab.label}
                </span>
                {isDisabled && (
                  <Lock size={14} className="text-gray-400" title="Requer processo selecionado" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default React.memo(Navigation);