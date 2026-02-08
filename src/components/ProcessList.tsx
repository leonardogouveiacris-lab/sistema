import React, { useState, useCallback, useMemo } from 'react';
import { Folder, Search, ChevronDown, Eye } from 'lucide-react';
import { Process, ProcessFilter } from '../types/Process';
import logger from '../utils/logger';

const ITEMS_PER_PAGE = 10;

interface ProcessListProps {
  processes: Process[];
  onSelectProcess: (process: Process) => void;
}

const ProcessList: React.FC<ProcessListProps> = ({ processes, onSelectProcess }) => {
  const [filter, setFilter] = useState<ProcessFilter>({ searchTerm: '' });
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const filteredProcesses = useMemo(() => {
    if (!filter.searchTerm.trim()) return processes;

    const searchTerm = filter.searchTerm.toLowerCase();
    return processes.filter((process) => (
      process.numeroProcesso.toLowerCase().includes(searchTerm) ||
      process.reclamante.toLowerCase().includes(searchTerm) ||
      process.reclamada.toLowerCase().includes(searchTerm)
    ));
  }, [processes, filter.searchTerm]);

  const visibleProcesses = useMemo(() => {
    return filteredProcesses.slice(0, visibleCount);
  }, [filteredProcesses, visibleCount]);

  const hasMoreItems = filteredProcesses.length > visibleCount;
  const remainingCount = filteredProcesses.length - visibleCount;

  const handleFilterChange = useCallback((searchTerm: string) => {
    setFilter({ searchTerm });
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleSelectProcess = useCallback((process: Process) => {
    logger.info(
      `Processo selecionado: ${process.numeroProcesso}`,
      'ProcessList',
      { processId: process.id }
    );
    onSelectProcess(process);
  }, [onSelectProcess]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const formatDateTime = useCallback((date: Date): string => {
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Lista de Processos</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie seus processos trabalhistas ({filteredProcesses.length} encontrados)
          </p>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Pesquisar por numero, reclamante ou reclamada..."
            value={filter.searchTerm}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            aria-label="Pesquisar processos"
          />
        </div>
      </div>

      <div className="p-6 max-h-[32rem] overflow-y-auto">
        {filteredProcesses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Folder className="text-gray-400" size={32} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter.searchTerm ? 'Nenhum processo encontrado' : 'Nenhum processo salvo'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {filter.searchTerm
                ? 'Tente ajustar os termos de busca para encontrar processos especificos'
                : 'Crie seu primeiro processo para comecar a gerenciar seus casos trabalhistas'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3" role="list">
              {visibleProcesses.map((process) => (
                <div
                  key={process.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors duration-200"
                  role="listitem"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 mb-1 truncate">
                        {process.numeroProcesso}
                      </h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Reclamante:</span> {process.reclamante}
                        </p>
                        <p>
                          <span className="font-medium">Reclamada:</span> {process.reclamada}
                        </p>
                        {process.observacoesGerais && (
                          <p className="line-clamp-2">
                            <span className="font-medium">Observacoes:</span> {process.observacoesGerais}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                      <div className="text-xs text-gray-500">
                        {formatDateTime(process.dataCriacao)}
                      </div>

                      <button
                        onClick={() => handleSelectProcess(process)}
                        className="flex items-center space-x-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-xs font-medium rounded-md border border-gray-200 hover:border-gray-300 transition-all duration-200 active:bg-blue-200"
                        aria-label={`Acessar processo ${process.numeroProcesso}`}
                      >
                        <Eye size={14} />
                        <span>Acessar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMoreItems && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleLoadMore}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ChevronDown size={16} />
                  <span>Carregar mais ({remainingCount} restantes)</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProcessList);
