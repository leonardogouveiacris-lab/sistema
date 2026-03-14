import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Link2, Search, Scale, Table } from 'lucide-react';
import { LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';

interface LancamentoReferencePickerProps {
  items: LancamentoReferenceItem[];
  query: string;
  anchorRect: DOMRect | null;
  onSelect: (item: LancamentoReferenceItem) => void;
  onClose: () => void;
}

const BADGE_COLORS: Record<string, string> = {
  'Deferida': 'bg-green-100 text-green-700',
  'Indeferida': 'bg-red-100 text-red-700',
  'Parcialmente Deferida': 'bg-yellow-100 text-yellow-700',
  'Reformada': 'bg-sky-100 text-sky-700',
  'Em Análise': 'bg-blue-100 text-blue-700',
  'Excluída': 'bg-gray-100 text-gray-600',
  'Procedente': 'bg-green-100 text-green-700',
  'Improcedente': 'bg-red-100 text-red-700',
  'Parcialmente Procedente': 'bg-yellow-100 text-yellow-700',
  'Homologado': 'bg-teal-100 text-teal-700',
  'Rejeitado': 'bg-orange-100 text-orange-700',
  'Deferido': 'bg-green-100 text-green-700',
  'Indeferido': 'bg-red-100 text-red-700',
};

function getBadgeColor(s: string): string {
  return BADGE_COLORS[s] || 'bg-gray-100 text-gray-600';
}

const LancamentoReferencePicker: React.FC<LancamentoReferencePickerProps> = ({
  items,
  query,
  anchorRect,
  onSelect,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.sublabel.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) onSelect(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filtered, activeIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!anchorRect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 320),
    top: anchorRect.bottom + 4,
    width: 300,
    zIndex: 9999,
  };

  if (anchorRect.bottom + 260 > window.innerHeight) {
    style.top = anchorRect.top - 260;
  }

  return (
    <div
      ref={containerRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <Search size={12} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500 font-medium">Referenciar lançamento</span>
        {query && (
          <span className="ml-auto text-xs text-gray-400">"{query}"</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-gray-400">
          Nenhum lançamento encontrado
        </div>
      ) : (
        <ul
          ref={listRef}
          className="max-h-56 overflow-y-auto"
        >
          {filtered.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                  i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${
                  item.type === 'verba' ? 'bg-green-100' : item.type === 'decisao' ? 'bg-amber-100' : item.type === 'tabela' ? 'bg-sky-100' : 'bg-cyan-100'
                }`}>
                  {item.type === 'verba'
                    ? <Link2 size={11} className="text-green-600" />
                    : item.type === 'decisao'
                      ? <Scale size={11} className="text-amber-600" />
                      : item.type === 'tabela'
                        ? <Table size={11} className="text-sky-600" />
                        : <FileText size={11} className="text-cyan-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-800 truncate">{item.label}</span>
                    {item.type === 'tabela' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 bg-sky-100 text-sky-700">
                        Col. {item.tableColumnLetter}
                      </span>
                    ) : item.sublabel && (
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${getBadgeColor(item.sublabel)}`}>
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                  {item.type === 'tabela' && item.tableName && (
                    <span className="text-xs text-gray-400">{item.tableName}</span>
                  )}
                  {item.type !== 'tabela' && item.paginaVinculada && (
                    <span className="text-xs text-gray-400">p.{item.paginaVinculada}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          <kbd className="bg-white border border-gray-200 rounded px-1">↑↓</kbd> navegar
        </span>
        <span className="text-xs text-gray-400">
          <kbd className="bg-white border border-gray-200 rounded px-1">Enter</kbd> selecionar
        </span>
        <span className="text-xs text-gray-400">
          <kbd className="bg-white border border-gray-200 rounded px-1">Esc</kbd> fechar
        </span>
      </div>
    </div>
  );
};

export default LancamentoReferencePicker;
