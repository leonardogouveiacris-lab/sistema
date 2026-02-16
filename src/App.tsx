import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ErrorBoundary,
  Header,
  Navigation,
  ProcessForm,
  ProcessList,
  ProcessDetails,
  AllDecisionsList,
  RelatorioVerbas
} from './components';
import { EmptyState } from './components/ui';
import { AlertTriangle } from 'lucide-react';
import FloatingPDFViewer from './components/FloatingPDFViewer';
import { PDFViewerProvider } from './contexts/PDFViewerContext';
import { ToastProvider } from './contexts/ToastContext';
import { VerbaProvider } from './contexts/VerbaContext';
import { DecisionProvider } from './contexts/DecisionContext';
import { DocumentoProvider } from './contexts/DocumentoContext';
import { useProcesses, useDecisions, useVerbas, useDocumentos, OperationResult } from './hooks';
import { Process, NewProcess, NewDecision, NewVerbaComLancamento, NewVerbaLancamento, NewDocumento } from './types';
import { logger, getUserFriendlyMessage } from './utils';

enum AppTabs {
  LISTA_PROCESSOS = 'lista-processos',
  PROCESSO = 'processo',
  RELATORIOS = 'relatorios'
}

const PROCESS_REQUIRED_TABS = [AppTabs.RELATORIOS];

const isProcessRequiredTab = (tab: string): boolean => {
  return PROCESS_REQUIRED_TABS.includes(tab as AppTabs);
};

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>(AppTabs.LISTA_PROCESSOS);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [globalError, setGlobalError] = useState<string>('');

  const {
    processes,
    isLoading: processesLoading,
    error: processesError,
    addProcess,
    updateProcess,
    removeProcess,
    importBackup: importProcessBackup,
    refreshProcesses
  } = useProcesses();

  const {
    decisions,
    isLoading: decisionsLoading,
    error: decisionsError,
    addDecision,
    updateDecision,
    removeDecision,
    refreshDecisions
  } = useDecisions();

  const {
    verbas,
    isLoading: verbasLoading,
    error: verbasError,
    addVerbaComLancamento,
    updateVerbaLancamento,
    removeVerbaLancamento,
    refreshVerbas
  } = useVerbas();

  const {
    documentos,
    isLoading: documentosLoading,
    error: documentosError,
    addDocumento,
    updateDocumento,
    removeDocumento,
    refreshDocumentos
  } = useDocumentos();

  const isInitialLoading = useMemo(() =>
    processesLoading && decisionsLoading && verbasLoading && documentosLoading,
    [processesLoading, decisionsLoading, verbasLoading, documentosLoading]
  );

  const systemError = useMemo(() =>
    globalError || processesError || decisionsError || verbasError || documentosError || '',
    [globalError, processesError, decisionsError, verbasError, documentosError]
  );

  const handleRetryConnection = useCallback(async () => {
    setGlobalError('');
    logger.info('Tentando reconectar aos serviços...', 'App - handleRetryConnection');
    await Promise.allSettled([
      refreshProcesses(),
      refreshDecisions(),
      refreshVerbas(),
      refreshDocumentos()
    ]);
    logger.success('Tentativa de reconexão concluída', 'App - handleRetryConnection');
  }, [refreshProcesses, refreshDecisions, refreshVerbas, refreshDocumentos]);

  const handleSaveProcess = useCallback(async (process: NewProcess): Promise<boolean> => {
    setGlobalError('');
    try {
      logger.info('Iniciando salvamento de processo', 'App - handleSaveProcess', { numeroProcesso: process.numeroProcesso });
      const success = await addProcess(process);
      if (success) {
        logger.success('Processo salvo com sucesso', 'App - handleSaveProcess', { numeroProcesso: process.numeroProcesso });
        return true;
      }
      return false;
    } catch (error) {
      const errorMessage = getUserFriendlyMessage(error);
      setGlobalError(errorMessage);
      logger.errorWithException('Erro ao salvar processo', error as Error, 'App - handleSaveProcess', { process });
      return false;
    }
  }, [addProcess]);

  const handleRemoveProcess = useCallback(async (processId: string): Promise<boolean> => {
    const processToRemove = processes.find(p => p.id === processId);
    if (!processToRemove) {
      setGlobalError('Processo não encontrado');
      return false;
    }
    try {
      const success = await removeProcess(processId);
      if (success) {
        logger.success(`Processo removido: ${processToRemove.numeroProcesso}`, 'App - handleRemoveProcess', { processId });
        return true;
      } else {
        throw new Error('Falha na remoção do processo');
      }
    } catch (error) {
      const errorMessage = getUserFriendlyMessage(error);
      setGlobalError(errorMessage);
      logger.errorWithException('Erro ao remover processo', error as Error, 'App - handleRemoveProcess', { processId });
      return false;
    }
  }, [removeProcess, processes]);

  const handleUpdateProcess = useCallback(async (
    processId: string,
    updatedData: Partial<NewProcess>
  ): Promise<boolean> => {
    setGlobalError('');

    try {
      const success = await updateProcess(processId, updatedData);

      if (!success) {
        throw new Error('Falha ao atualizar os dados do processo');
      }

      setSelectedProcess(prev => (
        prev && prev.id === processId
          ? { ...prev, ...updatedData, dataAtualizacao: new Date() }
          : prev
      ));

      logger.success('Processo atualizado com sucesso', 'App - handleUpdateProcess', {
        processId,
        updatedFields: Object.keys(updatedData)
      });

      return true;
    } catch (error) {
      const errorMessage = getUserFriendlyMessage(error);
      setGlobalError(errorMessage);

      logger.errorWithException(
        'Erro ao atualizar processo',
        error as Error,
        'App - handleUpdateProcess',
        { processId, updatedData }
      );

      return false;
    }
  }, [updateProcess]);

  const handleSelectProcess = useCallback((process: Process) => {
    setSelectedProcess(process);
    setActiveTab(AppTabs.PROCESSO);
    setGlobalError('');
    logger.info(`Processo selecionado: ${process.numeroProcesso}`, 'App - handleSelectProcess', { processId: process.id });
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedProcess(null);
    setActiveTab(AppTabs.LISTA_PROCESSOS);
    setGlobalError('');
    logger.info('Retorno para lista de processos', 'App - handleBackToList');
  }, []);

  useEffect(() => {
    if (!selectedProcess) return;

    const refreshedProcess = processes.find(p => p.id === selectedProcess.id);
    if (!refreshedProcess) return;

    setSelectedProcess(refreshedProcess);
  }, [processes, selectedProcess]);

  const handleTabChange = useCallback((tab: string) => {
    setGlobalError('');
    if (isProcessRequiredTab(tab) && !selectedProcess) {
      logger.warn(`Tentativa de navegar para aba que requer processo sem processo selecionado: ${tab}`, 'App - handleTabChange');
      setActiveTab(AppTabs.LISTA_PROCESSOS);
      setGlobalError('Por favor, selecione um processo antes de acessar esta seção.');
      setTimeout(() => setGlobalError(''), 4000);
      return;
    }
    setActiveTab(tab);
    logger.info(`Navegação para aba: ${tab}`, 'App - handleTabChange', { tab, hasSelectedProcess: !!selectedProcess });
  }, [selectedProcess]);

  const handleImportBackup = useCallback(() => {
    setGlobalError('');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);
          logger.info('Iniciando importação de backup', 'App - handleImportBackup', { fileName: file.name });
          if (backupData.processes && Array.isArray(backupData.processes)) {
            importProcessBackup(backupData.processes).then(success => {
              if (success) {
                logger.success('Backup de processos importado', 'App - handleImportBackup', { fileName: file.name });
              }
            });
          } else if (Array.isArray(backupData) && backupData.length > 0 && 'numeroProcesso' in backupData[0]) {
            importProcessBackup(backupData).then(success => {
              if (success) {
                logger.success('Backup de processos importado', 'App - handleImportBackup', { fileName: file.name });
              }
            });
          } else {
            throw new Error('Formato de backup não reconhecido ou inválido');
          }
        } catch (error) {
          const errorMessage = getUserFriendlyMessage(error);
          setGlobalError(`Erro ao importar backup: ${errorMessage}`);
          logger.errorWithException('Erro ao processar arquivo de backup', error as Error, 'App - handleImportBackup', { fileName: file.name });
        }
      };
      reader.onerror = () => {
        setGlobalError('Erro ao ler o arquivo de backup');
        logger.error('Erro ao ler arquivo', 'App - handleImportBackup');
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importProcessBackup]);

  const renderGlobalError = useCallback(() => {
    if (!systemError) return null;
    return (
      <div className="bg-red-50 border-b border-red-200 px-6 py-3" role="alert">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-red-600 text-xs">[ERROR]</span>
            <p className="text-red-800 text-sm font-medium">{systemError}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRetryConnection}
              className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 border border-red-300 rounded hover:bg-red-100 transition-colors"
              title="Tentar reconectar"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => setGlobalError('')}
              className="text-red-600 hover:text-red-800 text-lg font-medium"
              title="Fechar mensagem de erro"
            >
              x
            </button>
          </div>
        </div>
      </div>
    );
  }, [systemError, handleRetryConnection]);

  const renderContent = useCallback(() => {
    if (isInitialLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando sistema...</p>
            <p className="text-gray-400 text-xs mt-2">Conectando ao Supabase...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case AppTabs.LISTA_PROCESSOS:
        return (
          <div className="space-y-6">
            <ProcessForm
              onSaveProcess={handleSaveProcess}
              onImportBackup={handleImportBackup}
              isLoading={false}
            />
            <ProcessList
              processes={processes}
              onSelectProcess={handleSelectProcess}
            />
          </div>
        );

      case AppTabs.PROCESSO:
        if (selectedProcess) {
          return (
            <ErrorBoundary>
              <ProcessDetails
                process={selectedProcess}
                decisions={decisions}
                verbas={verbas}
                documentos={documentos}
                onBackToList={handleBackToList}
                onUpdateProcess={handleUpdateProcess}
                onRemoveProcess={handleRemoveProcess}
              />
            </ErrorBoundary>
          );
        }
        return (
          <AllDecisionsList
            decisions={decisions}
            processes={processes}
            onSelectProcess={handleSelectProcess}
          />
        );

      case AppTabs.RELATORIOS:
        return (
          <RelatorioVerbas
            selectedProcess={selectedProcess}
            verbas={verbas}
            decisions={decisions}
            documentos={documentos}
            onBackToProcessList={handleBackToList}
          />
        );

      default:
        logger.warn(`Aba desconhecida: ${activeTab}`, 'App - renderContent');
        return (
          <EmptyState
            icon={<AlertTriangle size={32} />}
            title="Página não encontrada"
            description="A página solicitada não foi encontrada"
            action={{
              label: 'Voltar à Lista',
              onClick: handleBackToList
            }}
          />
        );
    }
  }, [
    activeTab,
    selectedProcess,
    processes,
    decisions,
    verbas,
    documentos,
    isInitialLoading,
    handleSaveProcess,
    handleImportBackup,
    handleSelectProcess,
    handleBackToList,
    handleUpdateProcess,
    handleRemoveProcess
  ]);

  return (
    <div className="min-h-screen bg-gray-50 notranslate" translate="no">
      {renderGlobalError()}
      <Header />
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasSelectedProcess={!!selectedProcess}
        selectedProcessNumber={selectedProcess?.numeroProcesso}
      />
      {(processesLoading || decisionsLoading || verbasLoading) && !isInitialLoading && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2">
          <div className="container mx-auto max-w-4xl flex items-center justify-center">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span>
                {processesLoading && 'Carregando processos... '}
                {decisionsLoading && 'Carregando decisões... '}
                {verbasLoading && 'Carregando verbas... '}
              </span>
            </div>
          </div>
        </div>
      )}
      <main className="container mx-auto px-6 py-8 max-w-4xl" role="main" aria-label="Conteúdo principal">
        {renderContent()}
      </main>
      <FloatingPDFViewer processId={selectedProcess?.id} />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <DecisionProvider>
        <VerbaProvider>
          <DocumentoProvider>
            <PDFViewerProvider>
              <AppContent />
            </PDFViewerProvider>
          </DocumentoProvider>
        </VerbaProvider>
      </DecisionProvider>
    </ToastProvider>
  );
}

export default App;
