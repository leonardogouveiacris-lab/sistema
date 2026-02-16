import React from 'react';
import { Process, StatusVerbas } from '../types/Process';
import { Decision, NewDecision } from '../types/Decision';
import { Verba } from '../types/Verba';
import { Documento } from '../types/Documento';
import DecisionList from './DecisionList';
import ProcessVerbaList from './ProcessVerbaList';
import ProcessDocumentoList from './ProcessDocumentoList';
import ProcessDocumentManager from './ProcessDocumentManager';
import { AlertTriangle, ArrowLeft, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const getStatusVerbasBadge = (status: StatusVerbas) => {
  switch (status) {
    case 'concluido':
      return {
        label: 'Verbas Concluidas',
        className: 'bg-green-100 text-green-800 border-green-200',
        icon: CheckCircle2
      };
    case 'em_andamento':
      return {
        label: 'Verbas em Andamento',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Clock
      };
    case 'pendente':
    default:
      return {
        label: 'Verbas Pendentes',
        className: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: AlertCircle
      };
  }
};

/**
 * Componente ProcessDetails - Visualização detalhada de um processo específico
 * Exibe todas as informações de um processo selecionado da lista + suas decisões
 */
interface ProcessDetailsProps {
  process: Process;
  decisions: Decision[];                        // Todas as decisões do sistema (filtradas no componente filho)
  verbas: Verba[];                             // Todas as verbas do sistema para exibir as do processo
  documentos: Documento[];                     // Todos os documentos do sistema para exibir os do processo
  onBackToList: () => void;
  onRemoveProcess: (processId: string) => void;
}

const ProcessDetails: React.FC<ProcessDetailsProps> = ({
  process,
  decisions,
  verbas,
  documentos,
  onBackToList,
  onRemoveProcess
}) => {
  if (!process) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <AlertTriangle size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Processo não encontrado
          </h3>
          <p className="text-gray-500 mb-4">
            O processo selecionado não está disponível ou foi removido
          </p>
          <button
            onClick={onBackToList}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Voltar à Lista
          </button>
        </div>
      </div>
    );
  }

  const handleRemoveProcess = () => {
    onRemoveProcess(process.id);
    onBackToList();
  };

  const safeDecisions = Array.isArray(decisions) ? decisions : [];
  const safeVerbas = Array.isArray(verbas) ? verbas : [];
  const safeDocumentos = Array.isArray(documentos) ? documentos : [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de voltar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Detalhes do Processo</h2>
            <p className="text-sm text-gray-600 mt-1">Visualização completa das informações</p>
          </div>
          
          {/* Botões de ação do processo */}
          <div className="flex items-center space-x-4">
            {/* Botão secundário - Voltar à Lista */}
            <button
              onClick={onBackToList}
              className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200"
            >
              <ArrowLeft size={14} />
              <span className="text-sm font-medium">Voltar à Lista</span>
            </button>
            
            {/* Botão destrutivo - Remover Processo (design sutil) */}
            <button
              onClick={handleRemoveProcess}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-sm font-medium rounded-lg border border-red-200 hover:border-red-300 transition-all duration-200"
              title="Remover processo permanentemente"
            >
              <Trash2 size={14} />
              <span className="text-sm font-medium">Remover</span>
            </button>
          </div>
        </div>
        
        {/* Alerta de atenção sobre remoção */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex items-start">
            <AlertTriangle size={14} className="text-yellow-600 mr-2 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-800 font-medium">Atenção:</p>
              <p className="text-yellow-700 text-xs mt-1">
                A remoção do processo é permanente e não pode ser desfeita. 
                Certifique-se de fazer backup dos dados importantes antes de prosseguir.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gerenciamento de documentos PDF */}
      <ProcessDocumentManager processId={process.id} processNumber={process.numeroProcesso} />

      {/* Informações principais do processo */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Básicas</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Número do Processo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número do Processo
            </label>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <span className="text-gray-900 font-mono">{process.numeroProcesso}</span>
            </div>
          </div>

          {/* Data de Criação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data de Criação
            </label>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <span className="text-gray-900">
                {new Date(process.dataCriacao).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Status das Verbas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status das Verbas
            </label>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              {(() => {
                const statusInfo = getStatusVerbasBadge(process.statusVerbas);
                const Icon = statusInfo.icon;
                return (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.className}`}>
                    <Icon size={14} className="mr-1.5" />
                    {statusInfo.label}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Parte Autora */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parte Autora
            </label>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <span className="text-gray-900">{process.reclamante}</span>
            </div>
          </div>

          {/* Parte Re */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parte Re
            </label>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <span className="text-gray-900">{process.reclamada}</span>
            </div>
          </div>
        </div>

        {/* Observações Gerais (ocupa largura completa) */}
        {process.observacoesGerais && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações Gerais
            </label>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap">{process.observacoesGerais}</p>
            </div>
          </div>
        )}

        {/* Informações de auditoria */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">ID do Sistema:</span>
              <span className="ml-2 text-gray-600 font-mono">{process.id}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Última Atualização:</span>
              <span className="ml-2 text-gray-600">
                {new Date(process.dataAtualizacao).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Documentos Específicos do Processo */}
      <ProcessDocumentoList
        processId={process.id}
        processNumber={process.numeroProcesso}
        documentos={safeDocumentos}
      />

      {/* Decisões Específicas do Processo */}
      <DecisionList
        processId={process.id}
        processNumber={process.numeroProcesso}
        decisions={safeDecisions}
        onUpdateDecision={undefined}
        onRemoveDecision={undefined}
      />

      {/* Verbas Específicas do Processo */}
      <ProcessVerbaList
        processId={process.id}
        processNumber={process.numeroProcesso}
        verbas={safeVerbas}
        decisions={safeDecisions}
        onSelectVerba={undefined}
      />
    </div>
  );
};

export default React.memo(ProcessDetails);