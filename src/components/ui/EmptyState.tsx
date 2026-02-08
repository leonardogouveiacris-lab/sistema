/**
 * Componente EmptyState otimizado
 * Estado vazio reutilizável para diferentes contextos
 */

import React from 'react';

/**
 * Props do componente EmptyState
 */
interface EmptyStateProps {
  icon: string | React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
  iconColor?: string;
}

/**
 * Componente EmptyState
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  iconColor = 'text-gray-400'
}) => {
  const isStringIcon = typeof icon === 'string';

  return (
    <div className={`text-center py-12 ${className}`}>
      {/* Ícone */}
      <div className={`w-16 h-16 ${isStringIcon ? 'bg-gray-100' : 'bg-transparent'} rounded-lg mx-auto mb-6 flex items-center justify-center`}>
        {isStringIcon ? (
          <span className="text-gray-400 text-lg" aria-hidden="true">
            {icon}
          </span>
        ) : (
          <div className={iconColor}>{icon}</div>
        )}
      </div>

      {/* Título */}
      <h3 className="text-lg font-medium text-gray-900 mb-3">
        {title}
      </h3>

      {/* Descrição */}
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {description}
      </p>

      {/* Botão de ação (opcional) */}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          {action.icon && <span>{action.icon}</span>}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

export default React.memo(EmptyState);