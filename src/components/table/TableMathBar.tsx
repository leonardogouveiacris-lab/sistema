import React, { useState, useCallback } from 'react';
import { Copy, Check, Sigma, TrendingUp, Hash, ArrowDownUp, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { ProcessTableColumn, ProcessTableRow } from '../../types/ProcessTable';
import {
  computeSelectionStats,
  formatStatNumber,
  describeSelection,
} from '../../utils/selectionCalculator';

interface TableMathBarProps {
  selectedRefs: Set<string>;
  columns: ProcessTableColumn[];
  rows: ProcessTableRow[];
  onSelectRange?: (refs: Set<string>) => void;
}

interface CopiedState {
  key: string;
  timeout?: ReturnType<typeof setTimeout>;
}

const PRESET_LABELS = [
  { label: '12 meses', months: 12 },
  { label: '6 meses', months: 6 },
  { label: '3 meses', months: 3 },
  { label: '24 meses', months: 24 },
];

export function TableMathBar({ selectedRefs, columns, rows, onSelectRange }: TableMathBarProps) {
  const [copied, setCopied] = useState<CopiedState | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const stats = computeSelectionStats(selectedRefs, columns, rows);
  const description = describeSelection(selectedRefs);

  const handleCopy = useCallback(
    (key: string, value: string) => {
      navigator.clipboard.writeText(value).catch(() => {});
      setCopied((prev) => {
        if (prev?.timeout) clearTimeout(prev.timeout);
        const timeout = setTimeout(() => setCopied(null), 1500);
        return { key, timeout };
      });
    },
    []
  );

  const applyPreset = useCallback(
    (months: number) => {
      if (!onSelectRange) return;
      setShowPresets(false);

      const selectedLetters = new Set<string>();
      for (const ref of selectedRefs) {
        const match = ref.match(/^([A-Z]+)\d+$/);
        if (match) selectedLetters.add(match[1]);
      }

      const targetLetters =
        selectedLetters.size > 0
          ? Array.from(selectedLetters)
          : columns.filter((c) => c.type === 'data').slice(0, 1).map((c) => c.letter);

      if (targetLetters.length === 0 || rows.length === 0) return;

      const lastRow = rows.reduce((a, b) => (b.rowIndex > a.rowIndex ? b : a));
      const startRowIndex = Math.max(1, lastRow.rowIndex - months + 1);

      const newRefs = new Set<string>();
      for (const letter of targetLetters) {
        for (const row of rows) {
          if (row.rowIndex >= startRowIndex && row.rowIndex <= lastRow.rowIndex) {
            newRefs.add(`${letter}${row.rowIndex}`);
          }
        }
      }
      onSelectRange(newRefs);
    },
    [selectedRefs, columns, rows, onSelectRange]
  );

  if (selectedRefs.size === 0) return null;

  const statItems = [
    {
      key: 'sum',
      label: 'Soma',
      icon: <Sigma size={11} />,
      value: formatStatNumber(stats.sum),
    },
    {
      key: 'avg',
      label: 'Média',
      icon: <TrendingUp size={11} />,
      value: formatStatNumber(stats.average),
    },
    {
      key: 'count',
      label: 'Qtd',
      icon: <Hash size={11} />,
      value: String(stats.count),
    },
    {
      key: 'min',
      label: 'Mín',
      icon: <ArrowDownUp size={11} className="rotate-180" />,
      value: formatStatNumber(stats.min),
    },
    {
      key: 'max',
      label: 'Máx',
      icon: <ArrowDownUp size={11} />,
      value: formatStatNumber(stats.max),
    },
  ];

  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50">
      <div className="flex items-center gap-0 px-3 py-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-3 shrink-0">
          <span className="font-mono text-[10px] font-semibold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
            {description}
          </span>
          <span className="text-slate-400">{selectedRefs.size} cél.</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap flex-1">
          {stats.hasValues ? (
            statItems.map(({ key, label, icon, value }) => {
              const isCopied = copied?.key === key;
              return (
                <button
                  key={key}
                  onClick={() => handleCopy(key, value)}
                  title={`Copiar ${label}: ${value}`}
                  className={`
                    flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all
                    ${isCopied
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
                    }
                  `}
                >
                  {isCopied ? <Check size={10} className="text-emerald-600" /> : icon}
                  <span className="text-slate-400 text-[10px]">{label}</span>
                  <span className="font-semibold">{value}</span>
                  {!isCopied && <Copy size={9} className="text-slate-300 ml-0.5" />}
                </button>
              );
            })
          ) : (
            <span className="text-xs text-slate-400 italic">Nenhum valor numérico na seleção</span>
          )}
        </div>

        {onSelectRange && (
          <div className="relative ml-2 shrink-0">
            <button
              onClick={() => setShowPresets((v) => !v)}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors"
            >
              <Zap size={11} className="text-amber-500" />
              Seleção rápida
              {showPresets ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showPresets && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                {PRESET_LABELS.map(({ label, months }) => (
                  <button
                    key={months}
                    onClick={() => applyPreset(months)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
