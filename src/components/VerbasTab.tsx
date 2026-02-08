import React from 'react';
import { useState, useCallback } from 'react';
import { DollarSign, Folder, Settings } from 'lucide-react';
import { Process } from '../types/Process';
import { NewVerbaComLancamento, NewVerbaLancamento } from '../types/Verba';
import VerbaForm from './VerbaForm';
import VerbaList from './VerbaList';
import ProcessDocumentUpload from './ProcessDocumentUpload';
import { EmptyState } from './ui';
import TipoVerbaManagementModal from './ui/TipoVerbaManagementModal';
import { useVerbas, useDecisions } from '../hooks';
import logger from '../utils/logger';

interface VerbasTabProps {
  selectedProcess: Process | null;
  onBackToProcessList: () => void;
}

const VerbasTab: React.FC<VerbasTabProps> = ({
  selectedProcess,
  onBackToProcessList
}) => {
  const {
    verbas,
    addVerbaComLancamento,
    updateVerbaLancamento,
    removeVerbaLancamento,
    refreshVerbas
  } = useVerbas();

  const { decisions } = useDecisions();

  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [tiposVersion, setTiposVersion] = useState(0);
  const [verbasVersion, setVerbasVersion] = useState(0);

  const handleSaveVerba = useCallback(async (verba: NewVerbaComLancamento) => {
    const result = await addVerbaComLancamento(verba);
    return result.success;
  }, [addVerbaComLancamento]);

  const handleUpdateVerba = useCallback(async (verbaId: string, lancamentoId: string, updatedData: Partial<NewVerbaLancamento>) => {
    const result = await updateVerbaLancamento(verbaId, lancamentoId, updatedData);
    return result.success;
  }, [updateVerbaLancamento]);

  const handleRemoveVerba = useCallback(async (verbaId: string, lancamentoId: string) => {
    const result = await removeVerbaLancamento(verbaId, lancamentoId);
    return result.success;
  }, [removeVerbaLancamento]);

  const handleOpenManagementModal = useCallback(() => {
    setIsManagementModalOpen(true);

    logger.info(
      `Modal de gerenciamento de tipos aberto${selectedProcess ? ` para processo: ${selectedProcess.numeroProcesso}` : ''}`,
      'VerbasTab - handleOpenManagementModal',
      { processId: selectedProcess?.id }
    );
  }, [selectedProcess]);

  const handleCloseManagementModal = useCallback(() => {
    setIsManagementModalOpen(false);

    logger.info('Modal de gerenciamento de tipos fechado', 'VerbasTab - handleCloseManagementModal');
  }, []);

  const handleTiposUpdated = useCallback(() => {
    setTiposVersion(prev => prev + 1);

    logger.info(
      'Tipos atualizados, forçando refresh no VerbaForm',
      'VerbasTab - handleTiposUpdated',
      { newVersion: tiposVersion + 1 }
    );
  }, [tiposVersion]);

  const handleVerbasUpdated = useCallback(async () => {
    setVerbasVersion(prev => prev + 1);

    logger.info(
      'VerbasTab: Forçando refresh completo após atualização',
      'VerbasTab - handleVerbasUpdated',
      { newVersion: verbasVersion + 1, processId: selectedProcess?.id }
    );

    try {
      await refreshVerbas();
      logger.success(
        'VerbasTab: Verbas recarregadas do banco com sucesso',
        'VerbasTab - handleVerbasUpdated'
      );
    } catch (error) {
      logger.errorWithException(
        'VerbasTab: Erro ao recarregar verbas',
        error as Error,
        'VerbasTab - handleVerbasUpdated'
      );
    }
  }, [verbasVersion, selectedProcess?.id, refreshVerbas]);

  const renderEmptyState = () => (
    <EmptyState
      icon={<DollarSign size={48} />}
      iconColor="text-green-600"
      title="Gerenciar Verbas Trabalhistas"
      description="Selecione um processo para cadastrar e gerenciar suas verbas trabalhistas. As verbas ficam vinculadas ao processo específico e suas decisões judiciais."
      action={{
        label: "Ir para Lista de Processos",
        onClick: onBackToProcessList,
        icon: <Folder size={16} />
      }}
    />
  );

  const renderVerbasContent = () => {
    if (!selectedProcess) return null;

    logger.info(
      `Renderizando aba de verbas para processo: ${selectedProcess.numeroProcesso}`,
      'VerbasTab - renderVerbasContent',
      {
        processId: selectedProcess.id,
        processNumber: selectedProcess.numeroProcesso,
        verbaCount: verbas.filter(v => v.processId === selectedProcess.id).length,
        decisionCount: decisions.filter(d => d.processId === selectedProcess.id).length
      }
    );

    return (
      <>
        <div className="space-y-6">
          <ProcessDocumentUpload processId={selectedProcess.id} />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-900">
                  Sistema de Tipos Dinâmicos
                </h3>
                <p className="text-xs text-blue-800 mt-1">
                  Gerencie tipos de verba personalizados para este processo
                </p>
              </div>

              <button
                onClick={handleOpenManagementModal}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors duration-200"
              >
                <Settings size={16} />
                <span>Gerenciar Tipos</span>
              </button>
            </div>
          </div>

          <VerbaForm
            processId={selectedProcess.id}
            decisions={decisions}
            onSaveVerba={handleSaveVerba}
            refreshTrigger={tiposVersion}
          />

          <VerbaList
            processId={selectedProcess.id}
            verbas={verbas}
            decisions={decisions}
            onUpdateVerba={handleUpdateVerba}
            onRemoveVerba={handleRemoveVerba}
            onVerbasUpdated={handleVerbasUpdated}
            refreshTrigger={verbasVersion}
            refreshVerbas={refreshVerbas}
            onForceRefreshVerbas={refreshVerbas}
          />
        </div>

        <TipoVerbaManagementModal
          isOpen={isManagementModalOpen}
          onClose={handleCloseManagementModal}
          processId={selectedProcess.id}
          onTipoUpdated={handleTiposUpdated}
        />
      </>
    );
  };

  return selectedProcess ? renderVerbasContent() : renderEmptyState();
};

export default VerbasTab;
