import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, X, AlertTriangle, CheckSquare, Square, Loader2, CheckCircle2 } from 'lucide-react';
import { Process } from '../types/Process';

interface CleanupEmptyProcessesModalProps {
  onClose: () => void;
  onFetchEmpty: () => Promise<Process[]>;
  onBulkRemove: (ids: string[], onProgress: (done: number, total: number) => void) => Promise<{ removed: number; failed: number }>;
}

type Phase = 'loading' | 'review' | 'deleting' | 'done';

const CleanupEmptyProcessesModal: React.FC<CleanupEmptyProcessesModalProps> = ({
  onClose,
  onFetchEmpty,
  onBulkRemove,
}) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [emptyProcesses, setEmptyProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ removed: number; failed: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    onFetchEmpty().then((list) => {
      if (cancelled) return;
      setEmptyProcesses(list);
      setSelected(new Set(list.map((p) => p.id)));
      setPhase('review');
    });
    return () => { cancelled = true; };
  }, [onFetchEmpty]);

  const allSelected = emptyProcesses.length > 0 && selected.size === emptyProcesses.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(emptyProcesses.map((p) => p.id)));
    }
  }, [allSelected, emptyProcesses]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setProgress({ done: 0, total: ids.length });
    setPhase('deleting');
    const res = await onBulkRemove(ids, (done, total) => {
      setProgress({ done, total });
    });
    setResult(res);
    setPhase('done');
  }, [selected, onBulkRemove]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Limpar processos vazios</h2>
              <p className="text-xs text-gray-500">Processos sem nenhum lancamento, decisao ou verba</p>
            </div>
          </div>
          {phase !== 'deleting' && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <span className="text-sm">Buscando processos vazios...</span>
            </div>
          )}

          {phase === 'review' && emptyProcesses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 size={40} className="text-green-500" />
              <p className="text-base font-medium text-gray-800">Nenhum processo vazio encontrado</p>
              <p className="text-sm text-gray-500">Todos os processos possuem ao menos um lancamento.</p>
            </div>
          )}

          {phase === 'review' && emptyProcesses.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Esta acao e permanente e nao pode ser desfeita. Todos os PDFs e dados vinculados serao removidos.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {allSelected
                    ? <CheckSquare size={16} className="text-blue-600" />
                    : <Square size={16} />
                  }
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <span className="text-xs text-gray-500">{selected.size} de {emptyProcesses.length} selecionados</span>
              </div>

              <div className="space-y-2">
                {emptyProcesses.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => toggleOne(p.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(p.id)
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {selected.has(p.id)
                        ? <CheckSquare size={16} className="text-red-500" />
                        : <Square size={16} className="text-gray-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.numeroProcesso}</p>
                      <p className="text-xs text-gray-500 truncate">{p.reclamante} x {p.reclamada}</p>
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">{formatDate(p.dataCriacao)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 'deleting' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 size={32} className="animate-spin text-red-500" />
              <p className="text-sm font-medium text-gray-800">
                Removendo processos... {progress.done} de {progress.total}
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 size={40} className="text-green-500" />
              <p className="text-base font-semibold text-gray-900">Limpeza concluida</p>
              <div className="text-sm text-gray-600 text-center">
                <p><span className="font-medium text-green-700">{result.removed}</span> processo(s) removido(s) com sucesso.</p>
                {result.failed > 0 && (
                  <p className="mt-1"><span className="font-medium text-red-600">{result.failed}</span> falha(s) durante a remocao.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {(phase === 'review' || phase === 'done') && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {phase === 'done' ? 'Fechar' : 'Cancelar'}
            </button>
          )}
          {phase === 'review' && emptyProcesses.length > 0 && (
            <button
              onClick={handleDelete}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Trash2 size={14} />
              Excluir {selected.size > 0 ? `${selected.size} ` : ''}selecionado(s)
            </button>
          )}
          {phase === 'review' && emptyProcesses.length === 0 && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CleanupEmptyProcessesModal;
