import React, { useMemo } from 'react';
import { Trash2, CreditCard as Edit2, Calculator, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Verba, VerbaLancamento } from '../types/Verba';
import { LancamentoRefRenderer } from './ui';
import { hasLongText } from '../utils/previewText';
import { LancamentoReferenceItem } from '../hooks/useLancamentosForReference';

const SITUACAO_BADGE_COLORS: Record<string, string> = {
  'Deferida': 'bg-green-100 text-green-800 border-green-200',
  'Indeferida': 'bg-red-100 text-red-800 border-red-200',
  'Excluída': 'bg-red-100 text-red-800 border-red-200',
  'Parcialmente Deferida': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Reformada': 'bg-blue-100 text-blue-800 border-blue-200',
  'Em Análise': 'bg-gray-100 text-gray-800 border-gray-200',
  'Aguardando Documentação': 'bg-gray-100 text-gray-800 border-gray-200',
};

function getSituacaoBadgeColor(situacao: string): string {
  return SITUACAO_BADGE_COLORS[situacao] || 'bg-gray-100 text-gray-800 border-gray-200';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

interface VerbaLancamentoRowProps {
  verba: Verba;
  lancamento: VerbaLancamento;
  isCardExpanded: boolean;
  isConfirmingDelete: boolean;
  checkLoadingCalc: boolean;
  checkLoadingRev: boolean;
  referenceItems: LancamentoReferenceItem[];
  activeLancamentoId: string | null;
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

const VerbaLancamentoRow: React.FC<VerbaLancamentoRowProps> = ({
  verba,
  lancamento,
  isCardExpanded,
  isConfirmingDelete,
  checkLoadingCalc,
  checkLoadingRev,
  referenceItems,
  activeLancamentoId,
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
  const showExpandButton = useMemo(
    () => hasLongText(lancamento.fundamentacao) || hasLongText(lancamento.comentariosCalculistas),
    [lancamento.fundamentacao, lancamento.comentariosCalculistas]
  );

  const isActive = activeLancamentoId === lancamento.id;

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden group hover:shadow-sm transition-all duration-200 ${isConfirmingDelete ? 'border-red-200' : isActive ? 'border-blue-400 shadow-sm ring-1 ring-blue-200' : 'border-gray-200'}`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-medium text-gray-900 text-sm">
                {lancamento.decisaoVinculada}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSituacaoBadgeColor(lancamento.situacao)}`}>
                {lancamento.situacao}
              </span>
              {lancamento.paginaVinculada != null && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-md">
                  p.{lancamento.paginaVinculada}
                </span>
              )}
            </div>

            {lancamento.fundamentacao && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Fundamentação:</span>{' '}
                <LancamentoRefRenderer
                  html={lancamento.fundamentacao}
                  referenceItems={referenceItems}
                  onNavigate={onNavigate}
                  className={`inline text-gray-500 ${!isCardExpanded ? 'line-clamp-3' : ''}`}
                />
              </div>
            )}

            {lancamento.comentariosCalculistas && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Comentários:</span>{' '}
                <LancamentoRefRenderer
                  html={lancamento.comentariosCalculistas}
                  referenceItems={referenceItems}
                  onNavigate={onNavigate}
                  className={`inline text-gray-500 ${!isCardExpanded ? 'line-clamp-3' : ''}`}
                />
              </div>
            )}

            {showExpandButton && (
              <button
                onClick={() => onToggleExpansion(lancamento.id)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
              >
                {isCardExpanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}

            <div className="text-xs text-gray-400">
              Lançado em: {formatDate(lancamento.dataCriacao)}
            </div>

            <div className="flex items-center space-x-4 pt-2 mt-2 border-t border-gray-100">
              <button
                onClick={() => onToggleCalculista(lancamento.id, lancamento.checkCalculista)}
                disabled={checkLoadingCalc}
                className={`
                  inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200
                  ${lancamento.checkCalculista
                    ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }
                  ${checkLoadingCalc ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={lancamento.checkCalculista ? 'Desmarcar calculo concluido' : 'Marcar calculo concluido'}
              >
                <Calculator size={12} className="mr-1.5" />
                <span>Calculista</span>
                {lancamento.checkCalculista && (
                  <span className="ml-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>

              <button
                onClick={() => onToggleRevisor(lancamento.id, lancamento.checkRevisor, lancamento.checkCalculista)}
                disabled={!lancamento.checkCalculista || checkLoadingRev}
                className={`
                  inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200
                  ${lancamento.checkRevisor
                    ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                    : lancamento.checkCalculista
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }
                  ${checkLoadingRev ? 'opacity-50 cursor-not-allowed' : ''}
                  ${!lancamento.checkCalculista ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={
                  !lancamento.checkCalculista
                    ? 'Marque o calculo primeiro'
                    : lancamento.checkRevisor
                      ? 'Desmarcar revisao aprovada'
                      : 'Marcar revisao aprovada'
                }
              >
                <ClipboardCheck size={12} className="mr-1.5" />
                <span>Revisor</span>
                {lancamento.checkRevisor && (
                  <span className="ml-1.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>

              {lancamento.checkCalculista && lancamento.checkRevisor && (
                <span className="text-xs text-green-600 font-medium">Concluído</span>
              )}
              {lancamento.checkCalculista && !lancamento.checkRevisor && (
                <span className="text-xs text-amber-600 font-medium">Aguardando revisão</span>
              )}
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 flex-shrink-0">
              {canEdit && (
                <button
                  onClick={() => onEditLancamento(verba, lancamento)}
                  className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                  title={`Editar lançamento ${lancamento.decisaoVinculada}`}
                >
                  <Edit2 size={14} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDeletingId(isConfirmingDelete ? null : lancamento.id);
                  }}
                  className={`p-1.5 rounded-md transition-colors ${isConfirmingDelete ? 'text-red-700 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                  title={`Excluir lançamento ${lancamento.decisaoVinculada}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isConfirmingDelete && (
        <div className="mx-3 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-800">Excluir este lançamento?</p>
              <p className="text-xs text-red-600 mt-0.5">{verba.tipoVerba} · {lancamento.decisaoVinculada}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onSetDeletingId(null)}
                  className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onDeleteLancamento(verba, lancamento)}
                  className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VerbaLancamentoRow, (prev, next) => {
  return (
    prev.lancamento.id === next.lancamento.id &&
    new Date(prev.lancamento.dataCriacao).getTime() === new Date(next.lancamento.dataCriacao).getTime() &&
    prev.lancamento.checkCalculista === next.lancamento.checkCalculista &&
    prev.lancamento.checkRevisor === next.lancamento.checkRevisor &&
    prev.lancamento.situacao === next.lancamento.situacao &&
    prev.lancamento.decisaoVinculada === next.lancamento.decisaoVinculada &&
    prev.isCardExpanded === next.isCardExpanded &&
    prev.isConfirmingDelete === next.isConfirmingDelete &&
    prev.checkLoadingCalc === next.checkLoadingCalc &&
    prev.checkLoadingRev === next.checkLoadingRev &&
    prev.onToggleExpansion === next.onToggleExpansion &&
    prev.onToggleCalculista === next.onToggleCalculista &&
    prev.onToggleRevisor === next.onToggleRevisor &&
    prev.onEditLancamento === next.onEditLancamento &&
    prev.onSetDeletingId === next.onSetDeletingId &&
    prev.onDeleteLancamento === next.onDeleteLancamento &&
    prev.referenceItems === next.referenceItems &&
    prev.onNavigate === next.onNavigate &&
    prev.activeLancamentoId === next.activeLancamentoId
  );
});
