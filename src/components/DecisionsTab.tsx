import React from 'react';
import { Scale, Folder } from 'lucide-react';
import { Process } from '../types/Process';
import { NewDecision } from '../types/Decision';
import DecisionForm from './DecisionForm';
import DecisionList from './DecisionList';
import ProcessDocumentUpload from './ProcessDocumentUpload';
import { useDecisions } from '../hooks';
import logger from '../utils/logger';

interface DecisionsTabProps {
  selectedProcess: Process | null;
  onBackToProcessList: () => void;
}

const DecisionsTab: React.FC<DecisionsTabProps> = ({
  selectedProcess,
  onBackToProcessList
}) => {
  const {
    decisions,
    addDecision,
    updateDecision,
    removeDecision
  } = useDecisions();

  const handleSaveDecision = async (decision: NewDecision) => {
    await addDecision(decision);
  };

  const handleUpdateDecision = async (id: string, updatedData: Partial<NewDecision>) => {
    await updateDecision(id, updatedData);
  };

  const handleRemoveDecision = async (id: string) => {
    await removeDecision(id);
  };

  const renderEmptyState = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-blue-50 rounded-lg mx-auto mb-6 flex items-center justify-center">
          <Scale className="text-blue-600" size={32} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">
          Revisar Decisões Judiciais
        </h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Selecione um processo para cadastrar e gerenciar suas decisões judiciais.
          As decisões ficam vinculadas ao processo específico.
        </p>

        <button
          onClick={onBackToProcessList}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Folder size={16} />
          <span>Ir para Lista de Processos</span>
        </button>
      </div>
    </div>
  );

  const renderDecisionsContent = () => {
    if (!selectedProcess) return null;

    logger.info(
      `Renderizando aba de decisões para processo: ${selectedProcess.numeroProcesso}`,
      'DecisionsTab - renderDecisionsContent',
      {
        processId: selectedProcess.id,
        processNumber: selectedProcess.numeroProcesso,
        decisionCount: decisions.filter(d => d.processId === selectedProcess.id).length
      }
    );

    return (
      <div className="space-y-6">
        <ProcessDocumentUpload processId={selectedProcess.id} />

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <DecisionForm
            processId={selectedProcess.id}
            processNumber={selectedProcess.numeroProcesso}
            onSaveDecision={handleSaveDecision}
          />
        </div>

        <DecisionList
          processId={selectedProcess.id}
          processNumber={selectedProcess.numeroProcesso}
          decisions={decisions}
          onUpdateDecision={handleUpdateDecision}
          onRemoveDecision={handleRemoveDecision}
        />
      </div>
    );
  };

  return selectedProcess ? renderDecisionsContent() : renderEmptyState();
};

export default DecisionsTab;
