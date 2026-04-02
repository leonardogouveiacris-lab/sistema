import React, { useState, useMemo, useCallback } from 'react';
import { Trash2, CreditCard as Edit2, FileText, Search, Filter, ChevronDown, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { DocumentoLancamento } from '../types';
import { getPreviewText, hasLongText, PREVIEW_LENGTHS } from '../utils/previewText';
import { sortByPagina } from '../utils/sortByPagina';

const ITEMS_PER_PAGE = 10;

const TIPO_BADGE_COLORS: Record<string, string> = {
  'Petição Inicial': 'bg-blue-100 text-blue-800 border-blue-300',
  'Contestação': 'bg-red-100 text-red-800 border-red-300',
  'Réplica': 'bg-teal-100 text-teal-800 border-teal-300',
  'Laudo Pericial': 'bg-amber-100 text-amber-800 border-amber-300',
  'Recurso': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Contrato': 'bg-orange-100 text-orange-800 border-orange-300',
  'Sentença': 'bg-sky-100 text-sky-800 border-sky-300',
  'Acordo': 'bg-green-100 text-green-800 border-green-300',
};

const getTipoBadgeClass = (tipo: string) =>
  TIPO_BADGE_COLORS[tipo] || 'bg-gray-100 text-gray-700 border-gray-300';

const formatDate = (date: Date): string =>
  new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
    setConfirmingDeleteId(null);
  }, [onDelete]);

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

    return filtered.sort(sortByPagina);
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
              const isConfirming = confirmingDeleteId === documento.id;

              return (
                <div
                  key={documento.id}
                  className={`border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-all group ${isConfirming ? 'border-red-200' : 'border-gray-200'}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className="p-1.5 bg-orange-50 rounded-md flex-shrink-0">
                            <FileText size={13} className="text-orange-600" />
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getTipoBadgeClass(documento.tipoDocumento)}`}>
                            {documento.tipoDocumento}
                          </span>
                          {documento.paginaVinculada != null && (
                            <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                              p.{documento.paginaVinculada}
                            </span>
                          )}
                        </div>

                        {documento.comentarios && (
                          <div className="mt-1.5">
                            <p className={`text-xs leading-relaxed ${isCardExpanded ? 'text-gray-700' : 'text-gray-500 italic'}`}>
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

                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(documento.dataCriacao)}</span>
                          {documento.dataAtualizacao > documento.dataCriacao && (
                            <span className="flex items-center gap-1"><Clock size={10} />{formatDate(documento.dataAtualizacao)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => onEdit(documento)}
                          className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
                          title="Editar documento"
                          disabled={deletingId === documento.id}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(isConfirming ? null : documento.id)}
                          className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${isConfirming ? 'text-red-700 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                          title="Excluir documento"
                          disabled={deletingId === documento.id}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isConfirming && (
                    <div className="mx-3 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-red-800">Excluir "{documento.tipoDocumento}"?</p>
                          {documento.paginaVinculada != null && (
                            <p className="text-xs text-red-500 mt-0.5">p.{documento.paginaVinculada} · Esta ação não pode ser desfeita.</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              disabled={deletingId === documento.id}
                              className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDelete(documento.id)}
                              disabled={deletingId === documento.id}
                              className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === documento.id ? 'Excluindo...' : 'Excluir'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
