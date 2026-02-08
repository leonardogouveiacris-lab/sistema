import React, { useState, useMemo, useCallback } from 'react';
import { Verba } from '../types/Verba';
import { Decision } from '../types/Decision';
import { DollarSign, Search, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import logger from '../utils/logger';

const ITEMS_PER_PAGE = 5;

interface ProcessVerbaListProps {
  processId: string;
  processNumber: string;
  verbas: Verba[];
  decisions: Decision[];
  onSelectVerba?: (verba: Verba) => void;
}

const ProcessVerbaList: React.FC<ProcessVerbaListProps> = ({
  processId,
  processNumber,
  verbas,
  decisions,
  onSelectVerba
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [groupByTipo, setGroupByTipo] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const processVerbas = useMemo(() => {
    return verbas.filter(verba => verba.processId === processId);
  }, [verbas, processId]);

  const tiposUnicos = useMemo(() => {
    const tipos = new Set(processVerbas.map(v => v.tipoVerba));
    return Array.from(tipos).sort();
  }, [processVerbas]);

  const filteredVerbas = useMemo(() => {
    let filtered = processVerbas;

    if (selectedTipo !== 'all') {
      filtered = filtered.filter(v => v.tipoVerba === selectedTipo);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => {
        const tipoMatch = v.tipoVerba.toLowerCase().includes(query);
        const lancamentoMatch = v.lancamentos.some(l =>
          l.decisaoVinculada.toLowerCase().includes(query) ||
          l.situacao.toLowerCase().includes(query) ||
          l.fundamentacao?.toLowerCase().includes(query) ||
          l.comentariosCalculistas?.toLowerCase().includes(query)
        );
        return tipoMatch || lancamentoMatch;
      });
    }

    return filtered.sort((a, b) => {
      const aHasPagina = a.lancamentos.some(l => l.paginaVinculada);
      const bHasPagina = b.lancamentos.some(l => l.paginaVinculada);
      if (aHasPagina && !bHasPagina) return -1;
      if (!aHasPagina && bHasPagina) return 1;
      return new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime();
    });
  }, [processVerbas, selectedTipo, searchQuery]);

  const visibleVerbas = useMemo(() => {
    if (groupByTipo) return filteredVerbas.slice(0, visibleCount);
    return filteredVerbas;
  }, [filteredVerbas, visibleCount, groupByTipo]);

  const hasMoreItems = groupByTipo && filteredVerbas.length > visibleCount;
  const remainingCount = filteredVerbas.length - visibleCount;

  const totalLancamentos = useMemo(() => {
    return filteredVerbas.reduce((acc, verba) => acc + verba.lancamentos.length, 0);
  }, [filteredVerbas]);

  const stats = useMemo(() => ({
    total: processVerbas.length,
    totalLancamentos: processVerbas.reduce((acc, v) => acc + v.lancamentos.length, 0),
    porTipo: processVerbas.reduce((acc, v) => {
      acc[v.tipoVerba] = (acc[v.tipoVerba] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  }), [processVerbas]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleTipoChange = useCallback((value: string) => {
    setSelectedTipo(value);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const getDecisionInfo = useCallback((decisaoVinculada: string): Decision | undefined => {
    const decisionId = decisaoVinculada.split(' - ')[0];
    return decisions.find(d => d.idDecisao === decisionId);
  }, [decisions]);

  const handleSelectVerba = useCallback((verba: Verba) => {
    logger.info(
      `Verba selecionada na visualizacao do processo: ${verba.tipoVerba}`,
      'ProcessVerbaList - handleSelectVerba',
      {
        verbaId: verba.id,
        tipoVerba: verba.tipoVerba,
        totalLancamentos: verba.lancamentos.length
      }
    );

    if (onSelectVerba) {
      onSelectVerba(verba);
    }
  }, [onSelectVerba]);

  const getSituacaoBadgeColor = useCallback((situacao: string): string => {
    switch (situacao) {
      case 'Deferida':
        return 'bg-green-100 text-green-800';
      case 'Indeferida':
      case 'Excluida':
        return 'bg-red-100 text-red-800';
      case 'Parcialmente Deferida':
        return 'bg-yellow-100 text-yellow-800';
      case 'Reformada':
        return 'bg-blue-100 text-blue-800';
      case 'Em Analise':
      case 'Aguardando Documentacao':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const stripHtml = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  const getPreviewText = (html: string | undefined, maxLength = 150): string => {
    if (!html) return '';
    const text = stripHtml(html);
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  if (processVerbas.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="text-green-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Verbas do Processo
            </h3>
          </div>
        </div>

        <div className="text-center py-8">
          <DollarSign className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-600 mb-2">Nenhuma verba cadastrada</p>
          <p className="text-gray-500 text-sm">
            As verbas trabalhistas deste processo aparecerao aqui conforme forem cadastradas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <DollarSign className="text-green-600" size={20} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Verbas do Processo
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {totalLancamentos} lancamento(s) - Processo {processNumber}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isExpanded ? 'Recolher' : 'Expandir'}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar verbas..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedTipo}
                    onChange={(e) => handleTipoChange(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="all">Todos os tipos ({stats.total})</option>
                    {tiposUnicos.map(tipo => (
                      <option key={tipo} value={tipo}>
                        {tipo} ({stats.porTipo[tipo]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => setGroupByTipo(!groupByTipo)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  groupByTipo
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Agrupar por tipo"
              >
                Agrupar
              </button>
            </div>

            {searchQuery && (
              <div className="text-xs text-gray-600">
                {filteredVerbas.length} resultado(s) encontrado(s)
              </div>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="p-6">
          {filteredVerbas.length === 0 ? (
            <div className="text-center py-8">
              <Search className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-600 mb-2">Nenhuma verba encontrada</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTipo('all');
                }}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Limpar filtros
              </button>
            </div>
          ) : groupByTipo ? (
            <>
              <div className="space-y-4">
                {visibleVerbas.map((verba) => (
                  <div key={verba.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900">{verba.tipoVerba}</h4>
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                          {verba.lancamentos.length} lancamento(s)
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {verba.lancamentos.map(lancamento => (
                        <div key={lancamento.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                {lancamento.paginaVinculada && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                                    <DollarSign size={12} className="mr-1" />
                                    p.{lancamento.paginaVinculada}
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-gray-900">
                                  {lancamento.decisaoVinculada}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSituacaoBadgeColor(lancamento.situacao)}`}>
                                  {lancamento.situacao}
                                </span>
                              </div>
                              {lancamento.fundamentacao && (
                                <div className="text-sm text-gray-700 leading-relaxed mb-2">
                                  <span className="font-medium">Fundamentacao:</span>{' '}
                                  {getPreviewText(lancamento.fundamentacao)}
                                </div>
                              )}
                              {lancamento.comentariosCalculistas && (
                                <div className="text-sm text-gray-700 leading-relaxed mb-2">
                                  <span className="font-medium">Comentarios:</span>{' '}
                                  {getPreviewText(lancamento.comentariosCalculistas)}
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                {new Date(lancamento.dataCriacao).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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
                    <span>Carregar mais ({remainingCount} verbas restantes)</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {filteredVerbas.flatMap(verba =>
                verba.lancamentos.map(lancamento => (
                  <div
                    key={lancamento.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          {lancamento.paginaVinculada && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                              <DollarSign size={12} className="mr-1" />
                              p.{lancamento.paginaVinculada}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-gray-900">
                            {verba.tipoVerba}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-medium">Decisao:</span> {lancamento.decisaoVinculada}
                          <span className="mx-2">-</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSituacaoBadgeColor(lancamento.situacao)}`}>
                            {lancamento.situacao}
                          </span>
                        </div>
                        {lancamento.fundamentacao && (
                          <div className="text-sm text-gray-700 leading-relaxed mb-2">
                            <span className="font-medium">Fundamentacao:</span>{' '}
                            {getPreviewText(lancamento.fundamentacao)}
                          </div>
                        )}
                        {lancamento.comentariosCalculistas && (
                          <div className="text-sm text-gray-700 leading-relaxed mb-2">
                            <span className="font-medium">Comentarios:</span>{' '}
                            {getPreviewText(lancamento.comentariosCalculistas)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Cadastrado em {new Date(lancamento.dataCriacao).toLocaleDateString('pt-BR')} as{' '}
                          {new Date(lancamento.dataCriacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ProcessVerbaList);
