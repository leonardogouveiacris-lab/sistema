/**
 * Componente TipoVerbaManagementModal - Modal para gerenciamento avançado de tipos de verba
 * 
 * Este novo componente fornece uma interface dedicada para operações
 * avançadas de gerenciamento de tipos de verba dinâmicos, incluindo:
 * 
 * Funcionalidades:
 * - Visualizar todos os tipos existentes com estatísticas de uso
 * - Criar novos tipos personalizados
 * - Renomear tipos existentes (com confirmação de impacto)
 * - Remover tipos não utilizados
 * - Visualizar histórico de criação e uso
 * - Interface responsiva e intuitiva
 * 
 * Este modal foi criado separadamente para manter os formulários
 * principais limpos e focados, seguindo o princípio de responsabilidade única.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TipoStats } from '../../services/tipoVerba.service';
import { RenameResult } from '../../services/rename.service';
import { useTipoVerbas } from '../../hooks/useTipoVerbas';
import { useToast } from '../../contexts/ToastContext';
import { LoadingSpinner } from '.';
import logger from '../../utils/logger';

/**
 * Props do componente TipoVerbaManagementModal
 */
interface TipoVerbaManagementModalProps {
  isOpen: boolean;                    // Estado de abertura do modal
  onClose: () => void;               // Callback para fechar o modal
  processId?: string;                // ID do processo (opcional, para contexto específico)
  onTipoUpdated?: () => void;        // Callback para notificar atualizações (opcional)
}

/**
 * Enum para abas do modal de gerenciamento
 */
enum ManagementTab {
  LIST = 'list',           // Lista e estatísticas
  CREATE = 'create',       // Criar novo tipo
  RENAME = 'rename'        // Renomear tipo existente
}

/**
 * Componente principal do modal de gerenciamento
 */
const TipoVerbaManagementModal: React.FC<TipoVerbaManagementModalProps> = ({
  isOpen,
  onClose,
  processId,
  onTipoUpdated
}) => {
  // Hook simplificado para tipos de verba - contextualizado por processo se fornecido
  const {
    tipos: tiposDisponiveis,
    isLoading,
    error,
    carregarTipos,
    criarTipo,
    renomearTipo,
    validarTipo,
    obterEstatisticas,
    forcarRecarregamento
  } = useTipoVerbas(processId); // Passa processId se fornecido

  const toast = useToast();

  // Estados do modal
  const [activeTab, setActiveTab] = useState<ManagementTab>(ManagementTab.LIST);
  const [tipoStats, setTipoStats] = useState<TipoStats[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Estados para criação de novo tipo
  const [newTipoName, setNewTipoName] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  
  // Estados para renomeação
  const [selectedTipoForRename, setSelectedTipoForRename] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});

  /**
   * Carregamento inicial quando o modal abre
   */
  useEffect(() => {
    if (isOpen) {
      const initializeModal = async () => {
        try {
          logger.info(
            'Inicializando modal de gerenciamento de tipos',
            'TipoVerbaManagementModal - initialization',
            { processId }
          );

          // Carrega tipos disponíveis
          await carregarTipos(processId);
          
          // Se é aba de lista, carrega estatísticas
          if (activeTab === ManagementTab.LIST) {
            await loadStatsForAllTipos();
          }

        } catch (error) {
          logger.errorWithException(
            'Erro na inicialização do modal de gerenciamento',
            error as Error,
            'TipoVerbaManagementModal - initialization',
            { processId }
          );
        }
      };

      initializeModal();
    }
  }, [isOpen, activeTab, carregarTipos]); // Remove processId pois agora é gerenciado pelo hook

  /**
   * Carrega estatísticas para todos os tipos disponíveis
   */
  const loadStatsForAllTipos = useCallback(async () => {
    setIsLoadingStats(true);
    
    try {
      const statsPromises = tiposDisponiveis.map(tipo => obterEstatisticas(tipo));
      const stats = await Promise.all(statsPromises);
      
      // Ordena por total de verbas (mais usados primeiro)
      const sortedStats = stats.sort((a, b) => b.totalVerbas - a.totalVerbas);
      setTipoStats(sortedStats);

      logger.success(
        `Estatísticas carregadas para ${stats.length} tipos`,
        'TipoVerbaManagementModal - loadStatsForAllTipos',
        { tiposCount: stats.length }
      );

    } catch (error) {
      logger.errorWithException(
        'Erro ao carregar estatísticas dos tipos',
        error as Error,
        'TipoVerbaManagementModal - loadStatsForAllTipos'
      );
    } finally {
      setIsLoadingStats(false);
    }
  }, [tiposDisponiveis, obterEstatisticas]);

  /**
   * Handler para criar novo tipo
   */
  const handleCreateTipo = useCallback(async () => {
    try {
      setCreateErrors({});

      // Normaliza o nome para padrão Title Case
      const normalizedName = newTipoName.trim()
        .split(' ')
        .map(word => {
          if (word.length === 0) return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
      // Validação
      const validation = validarTipo(normalizedName);
      if (!validation.isValid) {
        setCreateErrors({ name: validation.errorMessage || 'Nome inválido' });
        return;
      }

      // Verifica duplicata
      if (tiposDisponiveis.includes(normalizedName)) {
        setCreateErrors({ name: 'Este tipo já existe' });
        return;
      }

      const resultado = await criarTipo(normalizedName, processId);
      
      if (resultado.success) {
        setNewTipoName('');
        setActiveTab(ManagementTab.LIST);
        await forcarRecarregamento();
        
        if (onTipoUpdated) onTipoUpdated();
        
        logger.success(
          `Novo tipo criado via modal: "${normalizedName}"`,
          'TipoVerbaManagementModal - handleCreateTipo',
          { originalInput: newTipoName, normalizedType: normalizedName, processId }
        );
      } else {
        setCreateErrors({ name: resultado.message });
      }

    } catch (error) {
      setCreateErrors({ name: 'Erro ao criar tipo' });
      logger.errorWithException(
        'Erro ao criar tipo via modal',
        error as Error,
        'TipoVerbaManagementModal - handleCreateTipo',
        { newType: newTipoName, processId }
      );
    }
  }, [newTipoName, validarTipo, tiposDisponiveis, criarTipo, processId, forcarRecarregamento, onTipoUpdated]);

  /**
   * Handler para renomear tipo
   * 
   * REFATORADO: Simplificado e com melhor tratamento de erros
   * Agora coordena adequadamente com o hook de gerenciamento
   */
  const handleRenameTipo = useCallback(async () => {
    try {
      // Limpa erros anteriores
      setRenameErrors({});

      // Validação básica: tipo selecionado
      if (!selectedTipoForRename) {
        setRenameErrors({ oldName: 'Selecione um tipo para renomear' });
        return;
      }

      // Validação básica: novo nome não vazio
      if (!renameNewName.trim()) {
        setRenameErrors({ newName: 'Digite o novo nome do tipo' });
        return;
      }

      // Normaliza o novo nome para padrão do sistema
      const normalizedNewName = renameNewName.trim()
        .split(' ')
        .map(word => {
          if (word.length === 0) return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');

      // Validação usando sistema centralizado
      const validation = validarTipo(renameNewName);
      if (!validation.isValid) {
        setRenameErrors({ newName: validation.errorMessage || 'Novo nome inválido' });
        return;
      }

      // Verifica se os tipos são diferentes após normalização
      const oldNormalized = selectedTipoForRename.trim();
      if (oldNormalized === normalizedNewName) {
        setRenameErrors({ newName: 'O novo nome é igual ao atual' });
        return;
      }

      // Executa a renomeação usando hook simplificado
      logger.info(
        `Executando renomeação confirmada: "${selectedTipoForRename}" → "${normalizedNewName}"`,
        'TipoVerbaManagementModal.handleRenameTipo',
        { oldType: selectedTipoForRename, newType: normalizedNewName, processId }
      );

      const result = await renomearTipo(selectedTipoForRename, normalizedNewName, processId);
      
      if (result.success) {
        // Limpa formulário após sucesso
        setSelectedTipoForRename('');
        setRenameNewName('');
        setRenameErrors({});
        
        // Volta para aba de listagem
        setActiveTab(ManagementTab.LIST);
        
        // Força refresh dos dados
        await forcarRecarregamento();
        
        // Notifica componente pai sobre alterações
        if (onTipoUpdated) onTipoUpdated();
        
        // Feedback para o usuário
        toast.success(`Tipo renomeado com sucesso! ${result.verbasAfetadas} verbas atualizadas.`);

        logger.success(
          `Renomeação via modal concluída com sucesso`,
          'TipoVerbaManagementModal.handleRenameTipo',
          { 
            oldType: selectedTipoForRename, 
            newType: normalizedNewName, 
            processId,
            result 
          }
        );
      } else {
        // Em caso de falha, mostra erro específico
        setRenameErrors({ newName: result.message });
        
        logger.warn(
          `Renomeação via modal falhou: ${result.message}`,
          'TipoVerbaManagementModal.handleRenameTipo',
          { oldType: selectedTipoForRename, newType: normalizedNewName, processId, result }
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao renomear tipo';
      setRenameErrors({ newName: errorMessage });
      
      logger.errorWithException(
        `Erro crítico na renomeação via modal: "${selectedTipoForRename}" → "${renameNewName}"`,
        error as Error,
        'TipoVerbaManagementModal.handleRenameTipo',
        { oldType: selectedTipoForRename, newType: renameNewName, processId }
      );
    }
  }, [selectedTipoForRename, renameNewName, validarTipo, renomearTipo, processId, forcarRecarregamento, onTipoUpdated]);

  /**
   * Handler simplificado para o botão de renomeação
   * 
   * Wrapper simples que chama a função principal de renomeação
   * Mantido para compatibilidade com interface existente
   */
  const handleExecuteRenameTipo = useCallback(async () => {
    await handleRenameTipo();
  }, [handleRenameTipo]);
  /**
   * Formata data para exibição
   */
  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('pt-BR');
  }, []);

  /**
   * Renderiza a aba de lista de tipos
   */
  const renderListTab = () => (
    <div className="space-y-4">
      {/* Cabeçalho da lista */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Tipos de Verba {processId ? 'do Processo' : 'do Sistema'} ({tiposDisponiveis.length})
        </h3>
        <button
          onClick={forcarRecarregamento}
          disabled={isLoading || isLoadingStats}
          className="inline-flex items-center space-x-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors duration-200"
        >
          <span className={isLoading || isLoadingStats ? 'animate-spin' : ''}>⟳</span>
          <span>Atualizar</span>
        </button>
      </div>

      {/* Lista de tipos com estatísticas */}
      {isLoadingStats ? (
        <div className="py-8">
          <LoadingSpinner size="md" text="Carregando estatísticas..." />
        </div>
      ) : tipoStats.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {isLoadingStats ? 'Carregando...' : 'Nenhum tipo encontrado'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {tipoStats.map((stats) => (
            <div key={stats.tipoVerba} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{stats.tipoVerba}</h4>
                  <div className="text-sm text-gray-600 mt-1">
                    <span>{stats.totalVerbas} verbas</span>
                    <span className="mx-2">•</span>
                    <span>{stats.totalLancamentos} lançamentos</span>
                    <span className="mx-2">•</span>
                    <span>{stats.processosUsando} processos</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Primeiro uso: {formatDate(stats.primeiraOcorrencia)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedTipoForRename(stats.tipoVerba);
                      setRenameNewName(stats.tipoVerba);
                      setActiveTab(ManagementTab.RENAME);
                    }}
                    className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                  >
                    Renomear
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /**
   * Renderiza a aba de criação de novo tipo
   */
  const renderCreateTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Criar Novo Tipo de Verba</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome do Novo Tipo *
        </label>
        <input
          type="text"
          value={newTipoName}
          onChange={(e) => setNewTipoName(e.target.value)}
          placeholder="Ex: Adicional de Transferência"
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            createErrors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          maxLength={100}
        />
        {createErrors.name && (
          <p className="text-red-500 text-xs mt-1">{createErrors.name}</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          O novo tipo ficará disponível para seleção em todos os formulários de verba
          {processId ? ' deste processo' : ' do sistema'}.
        </p>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setActiveTab(ManagementTab.LIST)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleCreateTipo}
          disabled={!newTipoName.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Criar Tipo
        </button>
      </div>
    </div>
  );

  /**
   * Renderiza a aba de renomeação
   */
  const renderRenameTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Renomear Tipo de Verba</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo Atual
        </label>
        <select
          value={selectedTipoForRename}
          onChange={(e) => setSelectedTipoForRename(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Selecione um tipo --</option>
          {tiposDisponiveis.map(tipo => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Novo Nome *
        </label>
        <input
          type="text"
          value={renameNewName}
          onChange={(e) => setRenameNewName(e.target.value)}
          placeholder="Digite o novo nome..."
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            renameErrors.newName ? 'border-red-500' : 'border-gray-300'
          }`}
          maxLength={100}
        />
        {renameErrors.newName && (
          <p className="text-red-500 text-xs mt-1">{renameErrors.newName}</p>
        )}
      </div>

      {selectedTipoForRename && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <span className="font-medium">Atenção:</span> A renomeação afetará todas as verbas 
            do tipo "{selectedTipoForRename}" {processId ? 'neste processo' : 'em todo o sistema'}.
          </p>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setActiveTab(ManagementTab.LIST)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleRenameTipo}
          disabled={!selectedTipoForRename || !renameNewName.trim() || selectedTipoForRename === renameNewName.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
        >
          Renomear Tipo
        </button>
      </div>
    </div>
  );

  /**
   * Renderiza as abas de navegação
   */
  const renderTabs = () => (
    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
      <button
        onClick={() => setActiveTab(ManagementTab.LIST)}
        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          activeTab === ManagementTab.LIST
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Lista e Estatísticas
      </button>
      <button
        onClick={() => setActiveTab(ManagementTab.CREATE)}
        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          activeTab === ManagementTab.CREATE
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Criar Tipo
      </button>
      <button
        onClick={() => setActiveTab(ManagementTab.RENAME)}
        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          activeTab === ManagementTab.RENAME
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Renomear Tipo
      </button>
    </div>
  );

  /**
   * Renderiza conteúdo baseado na aba ativa
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case ManagementTab.LIST:
        return renderListTab();
      case ManagementTab.CREATE:
        return renderCreateTab();
      case ManagementTab.RENAME:
        return renderRenameTab();
      default:
        return null;
    }
  };

  // Não renderiza nada se modal não estiver aberto
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-4xl max-h-screen overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Cabeçalho */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Gerenciar Tipos de Verba
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {processId ? `Processo específico` : 'Visualização global do sistema'}
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Navegação por abas */}
            {renderTabs()}

            {/* Mensagem de erro global */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Conteúdo das abas */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default TipoVerbaManagementModal;