import React, { useMemo } from 'react';
import { Scale } from 'lucide-react';
import { Verba, VerbaLancamento } from '../types/Verba';
import { LancamentoReferenceItem } from '../hooks/useLancamentosForReference';
import VerbaLancamentoRow from './VerbaLancamentoRow';

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function sortByPagina(lancamentos: VerbaLancamento[]): VerbaLancamento[] {
  return [...lancamentos].sort((a, b) => {
    const ap = a.paginaVinculada;
    const bp = b.paginaVinculada;
    if (ap != null && bp != null) return ap - bp;
    if (ap != null) return -1;
    if (bp != null) return 1;
    return new Date(a.dataCriacao).getTime() - new Date(b.dataCriacao).getTime();
  });
}

interface VerbaSectionProps {
  verba: Verba;
  expandedCards: Set<string>;
  deletingLancamentoId: string | null;
  checkLoading: Record<string, boolean>;
  referenceItems: LancamentoReferenceItem[];
  onNavigate: (item: LancamentoReferenceItem) => void;
  onToggleExpansion: (id: string) => void;
  onToggleCalculista: (id: string, currentValue: boolean) => void;
  onToggleRevisor: (id: string, currentValue: boolean, checkCalculista: boolean) => void;
  onEditLancamento: (verba: Verba, lancamento: VerbaLancamento) => void;
  onSetDeletingId: (id: string | null) => void;
  onDeleteLancamento: (verba: Verba, lancamento: VerbaLancamento) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const VerbaSection: React.FC<VerbaSectionProps> = ({
  verba,
  expandedCards,
  deletingLancamentoId,
  checkLoading,
  referenceItems,
  onNavigate,
  onToggleExpansion,
  onToggleCalculista,
  onToggleRevisor,
  onEditLancamento,
  onSetDeletingId,
  onDeleteLancamento,
  canEdit,
  canDelete,
}) => {
  const sortedLancamentos = useMemo(
    () => sortByPagina(verba.lancamentos),
    [verba.lancamentos]
  );

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-1">
            {verba.tipoVerba}
          </h4>
          <div className="text-sm text-gray-600 space-x-4">
            <span>{verba.lancamentos.length} lançamento{verba.lancamentos.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>Criado em: {formatDate(verba.dataCriacao)}</span>
          </div>
        </div>
        <div className="bg-white px-3 py-1 rounded-full border border-gray-300">
          <span className="text-sm font-medium text-gray-700">
            {verba.tipoVerba}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <h5 className="text-base font-medium text-gray-900 flex items-center">
          <Scale className="mr-2" size={16} />
          Lançamentos
        </h5>
        <div className="space-y-3">
          {sortedLancamentos.map((lancamento) => (
            <VerbaLancamentoRow
              key={lancamento.id}
              verba={verba}
              lancamento={lancamento}
              isCardExpanded={expandedCards.has(lancamento.id)}
              isConfirmingDelete={deletingLancamentoId === lancamento.id}
              checkLoadingCalc={!!checkLoading[`calc-${lancamento.id}`]}
              checkLoadingRev={!!checkLoading[`rev-${lancamento.id}`]}
              referenceItems={referenceItems}
              onNavigate={onNavigate}
              onToggleExpansion={onToggleExpansion}
              onToggleCalculista={onToggleCalculista}
              onToggleRevisor={onToggleRevisor}
              onEditLancamento={onEditLancamento}
              onSetDeletingId={onSetDeletingId}
              onDeleteLancamento={onDeleteLancamento}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(VerbaSection);
