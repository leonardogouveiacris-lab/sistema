/**
 * Componente Header - Cabeçalho principal do sistema
 * 
 * Este componente é responsável por exibir o cabeçalho da aplicação
 * com design profissional, informações do sistema e ações globais.
 * 
 * Funcionalidades:
 * - Branding da aplicação com design moderno
 * - Informações de status do sistema
 * - Botões de ação globais (sair, configurações)
 * - Layout responsivo para diferentes dispositivos
 * - Integração com sistema de notificações do Supabase
 */

import React, { useCallback, useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { SupabaseConfigMessage } from '../lib/supabase';
import { isSupabaseAvailable, testSupabaseConnection } from '../lib/supabase';
import logger from '../utils/logger';

/**
 * Props do componente Header
 */
interface HeaderProps {
  onLogout?: () => void;     // Callback opcional para função de logout
}

/**
 * Enum para estados de conexão com melhor tipagem
 */
enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected', 
  TESTING = 'testing',
  ERROR = 'error'
}

/**
 * Componente Header com design profissional
 */
const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  
  // ===== ESTADOS DO COMPONENTE =====
  
  /**
   * Estado da conexão com Supabase para feedback visual
   * Permite mostrar status em tempo real da conectividade
   */
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    isSupabaseAvailable ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED
  );

  /**
   * Estado para controle do teste de conexão
   * Evita múltiplos testes simultâneos
   */
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // ===== EFEITOS =====

  /**
   * Effect para testar conexão inicial com Supabase
   * 
   * Executa um teste de conectividade na montagem do componente
   * para verificar se o banco está realmente acessível
   */
  useEffect(() => {
    const testInitialConnection = async () => {
      if (isSupabaseAvailable) {
        setConnectionStatus(ConnectionStatus.TESTING);
        
        try {
          const isConnected = await testSupabaseConnection();
          setConnectionStatus(isConnected ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR);
          
          logger.info(
            `Teste inicial de conexão: ${isConnected ? 'sucesso' : 'falha'}`,
            'Header - useEffect',
            { isConnected }
          );
        } catch (error) {
          setConnectionStatus(ConnectionStatus.ERROR);
          logger.errorWithException(
            'Erro no teste inicial de conexão',
            error as Error,
            'Header - useEffect'
          );
        }
      }
    };

    testInitialConnection();
  }, []);

  // ===== HANDLERS =====

  /**
   * Handler otimizado para logout com confirmação
   * 
   * Solicita confirmação do usuário antes de executar logout
   * para evitar saídas acidentais
   */
  const handleLogout = useCallback(() => {
    logger.info('Logout executado pelo usuário', 'Header - handleLogout');

    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  }, [onLogout]);

  /**
   * Handler para reteste manual da conexão
   * 
   * Permite ao usuário verificar novamente a conectividade
   * com feedback visual durante o processo
   */
  const handleRetestConnection = useCallback(async () => {
    if (isTestingConnection) return; // Evita testes múltiplos

    setIsTestingConnection(true);
    setConnectionStatus(ConnectionStatus.TESTING);

    try {
      logger.info('Retestando conexão com Supabase...', 'Header - handleRetestConnection');
      
      const isConnected = await testSupabaseConnection();
      setConnectionStatus(isConnected ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR);
      
      logger.info(
        `Reteste de conexão: ${isConnected ? 'sucesso' : 'falha'}`,
        'Header - handleRetestConnection',
        { isConnected }
      );
    } catch (error) {
      setConnectionStatus(ConnectionStatus.ERROR);
      logger.errorWithException(
        'Erro no reteste de conexão',
        error as Error,
        'Header - handleRetestConnection'
      );
    } finally {
      setIsTestingConnection(false);
    }
  }, [isTestingConnection]);

  // ===== FUNÇÕES DE RENDERIZAÇÃO =====

  /**
   * Renderiza badge de status da conexão
   * 
   * Mostra status visual da conectividade com cores apropriadas
   * e permite reteste manual quando necessário
   * 
   * @returns JSX.Element com badge de status
   */
  const renderConnectionBadge = () => {
    // Configurações visuais para cada estado
    const statusConfig = {
      [ConnectionStatus.CONNECTED]: {
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '●',
        text: 'Online',
        clickable: false
      },
      [ConnectionStatus.DISCONNECTED]: {
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '●',
        text: 'Desconectado',
        clickable: true
      },
      [ConnectionStatus.TESTING]: {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⟳',
        text: 'Testando...',
        clickable: false
      },
      [ConnectionStatus.ERROR]: {
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '!',
        text: 'Erro',
        clickable: true
      }
    };

    const config = statusConfig[connectionStatus];
    const isClickable = config.clickable && !isTestingConnection;

    return (
      <div
        className={`
          inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
          ${config.color}
          ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}
        `}
        onClick={isClickable ? handleRetestConnection : undefined}
        title={isClickable ? 'Clique para testar conexão' : `Status: ${config.text}`}
      >
        <span 
          className={`mr-1 ${connectionStatus === ConnectionStatus.TESTING ? 'animate-spin' : ''}`}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <span>{config.text}</span>
      </div>
    );
  };

  /**
   * Renderiza informações do sistema de forma compacta
   * 
   * Mostra informações relevantes sem poluir a interface
   * 
   * @returns JSX.Element com informações do sistema
   */
  const renderSystemInfo = () => (
    <div className="hidden md:flex items-center space-x-4">
      {/* Status da conexão */}
      {renderConnectionBadge()}
      
      {/* Separador visual */}
      <span className="text-gray-300" aria-hidden="true">|</span>
      
      {/* Versão do sistema */}
      <span className="text-xs text-gray-500">
        v1.0.0
      </span>
    </div>
  );

  // ===== RENDERIZAÇÃO PRINCIPAL =====

  return (
    <>
      {/* 
        Componente de configuração do Supabase 
        Mostra apenas se Supabase não estiver configurado
      */}
      <SupabaseConfigMessage />
      
      {/* Cabeçalho principal com design profissional */}
      <header
        className="bg-white border-b border-gray-200 shadow-sm no-print"
        role="banner"
      >
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            
            {/* ===== SEÇÃO DE BRANDING ===== */}
            <div className="flex items-center">
              {/* Logo da empresa */}
              <img
                src="https://calculopro.com.br/wp-content/uploads/2024/11/logonegativa.png"
                alt="Logo da empresa"
                className="h-12 w-auto"
              />
            </div>

            {/* ===== SEÇÃO DE INFORMAÇÕES E AÇÕES ===== */}
            <div className="flex items-center space-x-6">
              
              {/* Informações do sistema (desktop only) */}
              {renderSystemInfo()}

              {/* Botão de logout com design moderno */}
              <button
                onClick={handleLogout}
                className="
                  flex items-center space-x-2 px-4 py-2 
                  text-gray-600 hover:text-gray-800 
                  hover:bg-gray-50 
                  rounded-lg border border-gray-200 hover:border-gray-300
                  transition-all duration-200 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  shadow-sm hover:shadow-md
                "
                aria-label="Sair do sistema"
                title="Sair do sistema"
              >
                <LogOut size={14} aria-hidden="true" />
                <span className="text-sm font-medium">Sair</span>
              </button>
            </div>
          </div>

          {/* ===== BARRA DE INFORMAÇÕES MOBILE ===== */}
          {/* Mostra informações do sistema em dispositivos móveis */}
          <div className="md:hidden mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {renderConnectionBadge()}
                <span className="text-xs text-gray-500">v1.0.0</span>
              </div>
              
              {/* Indicador adicional para mobile */}
              <div className="text-xs text-gray-500">
                Sistema de Processos
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default React.memo(Header);