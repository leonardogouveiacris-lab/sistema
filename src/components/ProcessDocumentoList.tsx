/**
 * ProcessDocumentoList - Lista de documentos específicos de um processo
 *
 * Exibe todos os documentos (lançamentos) cadastrados para um processo específico
 * com funcionalidades de pesquisa, filtros e agrupamento
 */

import React, { useState, useMemo } from 'react';
import { Documento } from '../types/Documento';
import { FileText, Search, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { getPreviewText, hasLongText, PREVIEW_LENGTHS } from '../utils/previewText';

interface ProcessDocumentoListProps {
  processId: string;
  processNumber: string;
  documentos: Documento[];
}

const ProcessDocumentoList: React.FC<ProcessDocumentoListProps> = ({
  processId,
  processNumber,
  documentos
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [groupByTipo, setGroupByTipo] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCardExpansion = (docId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const processDocumentos = useMemo(() => {
    return documentos.filter(d => d.processId === processId);
  }, [documentos, processId]);

  const tiposUnicos = useMemo(() => {
    const tipos = new Set(processDocumentos.map(d => d.tipoDocumento));
    return Array.from(tipos).sort();
  }, [processDocumentos]);

  const filteredDocumentos = useMemo(() => {
    let filtered = processDocumentos;

    if (selectedTipo !== 'all') {
      filtered = filtered.filter(d => d.tipoDocumento === selectedTipo);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.tipoDocumento.toLowerCase().includes(query) ||
        d.comentarios?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (a.paginaVinculada && !b.paginaVinculada) return -1;
      if (!a.paginaVinculada && b.paginaVinculada) return 1;
      if (a.paginaVinculada && b.paginaVinculada) {
        return a.paginaVinculada - b.paginaVinculada;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [processDocumentos, selectedTipo, searchQuery]);

  const groupedDocumentos = useMemo(() => {
    if (!groupByTipo) return null;

    const groups = new Map<string, Documento[]>();
    filteredDocumentos.forEach(doc => {
      const tipo = doc.tipoDocumento;
      if (!groups.has(tipo)) {
        groups.set(tipo, []);
      }
      groups.get(tipo)!.push(doc);
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDocumentos, groupByTipo]);

  const stats = useMemo(() => ({
    total: processDocumentos.length,
    comPaginaVinculada: processDocumentos.filter(d => d.paginaVinculada).length,
    porTipo: processDocumentos.reduce((acc, d) => {
      acc[d.tipoDocumento] = (acc[d.tipoDocumento] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  }), [processDocumentos]);

  if (processDocumentos.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="text-orange-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Documentos do Processo
            </h3>
          </div>
        </div>

        <div className="text-center py-8">
          <FileText className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-600 mb-2">Nenhum documento cadastrado</p>
          <p className="text-gray-500 text-sm">
            Abra o visualizador de PDF para adicionar documentos vinculados às páginas
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
            <FileText className="text-orange-600" size={20} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Documentos do Processo
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {processDocumentos.length} documento(s) • Processo {processNumber}
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
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedTipo}
                    onChange={(e) => setSelectedTipo(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                    ? 'bg-orange-50 text-orange-700 border-orange-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Agrupar por tipo"
              >
                Agrupar
              </button>
            </div>

            {searchQuery && (
              <div className="text-xs text-gray-600">
                {filteredDocumentos.length} resultado(s) encontrado(s)
              </div>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="p-6">
          {filteredDocumentos.length === 0 ? (
            <div className="text-center py-8">
              <Search className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-600 mb-2">Nenhum documento encontrado</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTipo('all');
                }}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                Limpar filtros
              </button>
            </div>
          ) : groupByTipo && groupedDocumentos ? (
            <div className="space-y-4">
              {groupedDocumentos.map(([tipo, docs]) => (
                <div key={tipo} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">{tipo}</h4>
                      <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                        {docs.length}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {docs.map(doc => {
                      const isCardExpanded = expandedCards.has(doc.id);
                      const showExpandButton = hasLongText(doc.comentarios);

                      return (
                      <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              {doc.paginaVinculada && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 rounded">
                                  <FileText size={12} className="mr-1" />
                                  p.{doc.paginaVinculada}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            {doc.comentarios && (
                              <div className="mb-2">
                                <p className={`text-sm leading-relaxed ${isCardExpanded ? 'text-gray-700' : 'text-gray-600 italic'}`}>
                                  {!isCardExpanded
                                    ? getPreviewText(doc.comentarios, PREVIEW_LENGTHS.LIST_VIEW)
                                    : doc.comentarios
                                  }
                                </p>
                                {showExpandButton && (
                                  <button
                                    onClick={() => toggleCardExpansion(doc.id)}
                                    className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-1"
                                  >
                                    {isCardExpanded ? 'Ver menos' : 'Ver mais'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocumentos.map(doc => {
                const isCardExpanded = expandedCards.has(doc.id);
                const showExpandButton = hasLongText(doc.comentarios);

                return (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        {doc.paginaVinculada && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 rounded">
                            <FileText size={12} className="mr-1" />
                            p.{doc.paginaVinculada}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {doc.tipoDocumento}
                        </span>
                      </div>
                      {doc.comentarios && (
                        <div className="mb-2">
                          <p className={`text-xs leading-relaxed ${isCardExpanded ? 'text-gray-700' : 'text-gray-600 italic'}`}>
                            {!isCardExpanded
                              ? getPreviewText(doc.comentarios, PREVIEW_LENGTHS.LIST_VIEW)
                              : doc.comentarios
                            }
                          </p>
                          {showExpandButton && (
                            <button
                              onClick={() => toggleCardExpansion(doc.id)}
                              className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-1"
                            >
                              {isCardExpanded ? 'Ver menos' : 'Ver mais'}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Cadastrado em {new Date(doc.createdAt).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(doc.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ProcessDocumentoList);
