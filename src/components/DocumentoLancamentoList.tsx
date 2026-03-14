import React, { useState, useMemo, useCallback } from 'react';
import { Trash2, Edit2, FileText, Search, Filter, ChevronDown } from 'lucide-react';
import { DocumentoLancamento } from '../types';
import { getPreviewText, hasLongText, PREVIEW_LENGTHS } from '../utils/previewText';

const ITEMS_PER_PAGE = 10;

interface DocumentoLancamentoListProps {
  documentos: DocumentoLancamento[];
  onEdit: (documento: DocumentoLancamento) => void;
  onDelete: (id: string) => void;
}

const DocumentoLancamentoList: React.FC<DocumentoLancamentoListProps> = ({
  documentos,
  onEdit,
  onDelete,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const formatDate = useCallback((date: Date): string => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const toggleCardExpansion = useCallback((documentoId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentoId)) {
        newSet.delete(documentoId);
      } else {
        newSet.add(documentoId);
      }
      return newSet;
    });
  }, []);

  const tiposUnicos = useMemo(() => {
    const tipos = new Set(documentos.map(d => d.tipoDocumento));
    return Array.from(tipos).sort();
  }, [documentos]);

  const filteredDocumentos = useMemo(() => {
    let filtered = documentos;

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
      return new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime();
    });
  }, [documentos, selectedTipo, searchQuery]);

  const visibleDocumentos = useMemo(() => {
    return filteredDocumentos.slice(0, visibleCount);
  }, [filteredDocumentos, visibleCount]);

  const hasMoreItems = filteredDocumentos.length > visibleCount;
  const remainingCount = filteredDocumentos.length - visibleCount;

  const stats = useMemo(() => ({
    total: documentos.length,
    porTipo: documentos.reduce((acc, d) => {
      acc[d.tipoDocumento] = (acc[d.tipoDocumento] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  }), [documentos]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleTipoChange = useCallback((value: string) => {
    setSelectedTipo(value);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  if (documentos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>Nenhum lancamento de documento cadastrado ainda.</p>
        <p className="text-sm mt-1">Adicione documentos usando o formulario acima.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documentos.length > 1 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Filter size={16} className="text-gray-400" />
                <select
                  value={selectedTipo}
                  onChange={(e) => handleTipoChange(e.target.value)}
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
          </div>

          {searchQuery && (
            <div className="text-xs text-gray-600">
              {filteredDocumentos.length} resultado(s) encontrado(s)
            </div>
          )}
        </div>
      )}

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
      ) : (
        <>
          <div className="space-y-3">
            {visibleDocumentos.map((documento) => {
              const isCardExpanded = expandedCards.has(documento.id);
              const showExpandButton = documento.comentarios && hasLongText(documento.comentarios);

              return (
                <div
                  key={documento.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 transition-all bg-white group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
                        <h4 className="font-medium text-gray-900 truncate">
                          {documento.tipoDocumento}
                        </h4>
                        {documento.paginaVinculada && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                            p.{documento.paginaVinculada}
                          </span>
                        )}
                      </div>

                      {documento.comentarios && (
                        <div className="mt-2">
                          <p className={`text-xs leading-relaxed ${isCardExpanded ? 'text-gray-700' : 'text-gray-600 italic'}`}>
                            {!isCardExpanded
                              ? getPreviewText(documento.comentarios, PREVIEW_LENGTHS.LIST_VIEW)
                              : documento.comentarios
                            }
                          </p>
                          {showExpandButton && (
                            <button
                              onClick={() => toggleCardExpansion(documento.id)}
                              className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-1"
                            >
                              {isCardExpanded ? 'Ver menos' : 'Ver mais'}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center text-xs text-gray-500 space-x-4">
                        <span>Criado: {formatDate(documento.dataCriacao)}</span>
                        {documento.dataAtualizacao > documento.dataCriacao && (
                          <span>Atualizado: {formatDate(documento.dataAtualizacao)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => onEdit(documento)}
                        className="p-2 text-orange-600 hover:bg-orange-100 rounded transition-colors"
                        title="Editar documento"
                        disabled={deletingId === documento.id}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(documento.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Excluir documento"
                        disabled={deletingId === documento.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
  );
};

export default React.memo(DocumentoLancamentoList);
