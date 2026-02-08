import React, { useMemo } from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ChecklistStats, ChecklistStatus } from '../types/Verba';

interface VerbaChecklistProgressProps {
  stats: ChecklistStats;
  filterStatus: ChecklistStatus | 'todos';
  onFilterChange: (status: ChecklistStatus | 'todos') => void;
}

const VerbaChecklistProgress: React.FC<VerbaChecklistProgressProps> = ({
  stats,
  filterStatus,
  onFilterChange
}) => {
  const progressWidth = useMemo(() => {
    if (stats.total === 0) return 0;
    return (stats.concluidos / stats.total) * 100;
  }, [stats.total, stats.concluidos]);

  const aguardandoWidth = useMemo(() => {
    if (stats.total === 0) return 0;
    return (stats.aguardandoRevisao / stats.total) * 100;
  }, [stats.total, stats.aguardandoRevisao]);

  const filterButtons: { status: ChecklistStatus | 'todos'; label: string; count: number }[] = [
    { status: 'todos', label: 'Todos', count: stats.total },
    { status: 'pendente', label: 'Pendentes', count: stats.pendentes },
    { status: 'aguardando_revisao', label: 'Aguardando Revisao', count: stats.aguardandoRevisao },
    { status: 'concluido', label: 'Concluidos', count: stats.concluidos },
  ];

  if (stats.total === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">Progresso do Checklist</h4>
        <span className="text-sm font-semibold text-gray-900">
          {stats.percentualConcluido}% concluido
        </span>
      </div>

      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${progressWidth}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-400 transition-all duration-500 ease-out"
          style={{ left: `${progressWidth}%`, width: `${aguardandoWidth}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5"></span>
            {stats.concluidos} concluidos
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-1.5"></span>
            {stats.aguardandoRevisao} aguardando revisao
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 mr-1.5"></span>
            {stats.pendentes} pendentes
          </span>
        </div>
        <span className="text-gray-400">{stats.total} lancamentos</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterButtons.map(({ status, label, count }) => {
          const isActive = filterStatus === status;
          let Icon = AlertCircle;
          let activeClass = 'bg-gray-100 text-gray-700 border-gray-300';

          if (status === 'concluido') {
            Icon = CheckCircle2;
            activeClass = 'bg-green-50 text-green-700 border-green-300';
          } else if (status === 'aguardando_revisao') {
            Icon = Clock;
            activeClass = 'bg-amber-50 text-amber-700 border-amber-300';
          } else if (status === 'pendente') {
            Icon = AlertCircle;
            activeClass = 'bg-gray-50 text-gray-600 border-gray-300';
          }

          return (
            <button
              key={status}
              onClick={() => onFilterChange(status)}
              className={`
                inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200
                ${isActive ? activeClass : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}
              `}
            >
              {status !== 'todos' && <Icon size={12} className="mr-1.5" />}
              {label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                isActive ? 'bg-white/50' : 'bg-gray-100'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VerbaChecklistProgress;
