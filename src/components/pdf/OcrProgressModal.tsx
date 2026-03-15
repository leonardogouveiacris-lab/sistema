import React, { useState, useCallback, useMemo } from 'react';
import { X, ScanLine, AlertCircle, CheckCircle, Loader, FileText, Wand2 } from 'lucide-react';
import type { OcrState } from '../../hooks/usePdfOcr';

interface OcrProgressModalProps {
  isOpen: boolean;
  ocrState: OcrState;
  totalPages: number;
  onStart: (pages: number[]) => void;
  onCancel: () => void;
  onClose: () => void;
}

type SelectionMode = 'detected' | 'manual' | 'all';

const statusLabel: Record<OcrState['status'], string> = {
  idle: 'Pronto',
  detecting: 'Detectando paginas...',
  running: 'Executando OCR...',
  saving: 'Salvando resultados...',
  done: 'OCR concluido',
  error: 'Erro no OCR',
};

function parsePageInput(input: string, totalPages: number): { pages: number[]; error: string | null } {
  const pages = new Set<number>();
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) {
    return { pages: [], error: 'Informe pelo menos uma pagina ou intervalo.' };
  }

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 1 || n > totalPages) {
        return { pages: [], error: `Pagina ${n} fora do intervalo (1-${totalPages}).` };
      }
      pages.add(n);
    } else if (/^\d+-\d+$/.test(part)) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (start > end) {
        return { pages: [], error: `Intervalo invalido: ${part}. O inicio deve ser menor que o fim.` };
      }
      if (start < 1 || end > totalPages) {
        return { pages: [], error: `Intervalo ${part} fora dos limites (1-${totalPages}).` };
      }
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      return { pages: [], error: `Formato invalido: "${part}". Use numeros ou intervalos como "1-5".` };
    }
  }

  return { pages: Array.from(pages).sort((a, b) => a - b), error: null };
}

const OcrProgressModal: React.FC<OcrProgressModalProps> = ({
  isOpen,
  ocrState,
  totalPages,
  onStart,
  onCancel,
  onClose,
}) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('detected');
  const [manualInput, setManualInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const { status, progress, lowTextPages, documentStatus, error, isRunning } = ocrState;
  const isDone = status === 'done';
  const isError = status === 'error';
  const canStart = !isRunning && !isDone;

  const progressPercent =
    progress && progress.totalPages > 0
      ? Math.round((progress.currentPage / progress.totalPages) * 100)
      : 0;

  const progressStatusLabel =
    progress?.status === 'rendering'
      ? 'Renderizando'
      : progress?.status === 'recognizing'
      ? 'Reconhecendo texto'
      : 'Salvando';

  const allPages = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  const { parsedPages, parseError } = useMemo(() => {
    if (selectionMode !== 'manual') return { parsedPages: [], parseError: null };
    if (!manualInput.trim()) return { parsedPages: [], parseError: null };
    const result = parsePageInput(manualInput, totalPages);
    return { parsedPages: result.pages, parseError: result.error };
  }, [selectionMode, manualInput, totalPages]);

  const effectivePages = useMemo(() => {
    if (selectionMode === 'detected') return lowTextPages;
    if (selectionMode === 'all') return allPages;
    return parsedPages;
  }, [selectionMode, lowTextPages, allPages, parsedPages]);

  const handleManualInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setManualInput(e.target.value);
    setInputError(null);
  }, []);

  const handleStart = useCallback(() => {
    if (selectionMode === 'manual') {
      const result = parsePageInput(manualInput, totalPages);
      if (result.error) {
        setInputError(result.error);
        return;
      }
      if (result.pages.length === 0) {
        setInputError('Informe pelo menos uma pagina.');
        return;
      }
      onStart(result.pages);
    } else {
      onStart(effectivePages);
    }
  }, [selectionMode, manualInput, totalPages, effectivePages, onStart]);

  const handleClose = useCallback(() => {
    if (!isRunning) {
      setSelectionMode('detected');
      setManualInput('');
      setInputError(null);
    }
    onClose();
  }, [isRunning, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <ScanLine size={18} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">OCR — Reconhecimento de Texto</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Page selection — only shown when idle/ready */}
          {!isRunning && !isDone && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700">Selecionar paginas para OCR</p>

              {/* Mode tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                {([
                  { key: 'detected', label: 'Detectadas', icon: <Wand2 size={12} />, count: lowTextPages.length },
                  { key: 'manual', label: 'Manual', icon: <FileText size={12} />, count: null },
                  { key: 'all', label: 'Todas', icon: null, count: totalPages },
                ] as const).map(({ key, label, icon, count }) => (
                  <button
                    key={key}
                    onClick={() => { setSelectionMode(key); setInputError(null); }}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      selectionMode === key
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {icon}
                      {label}
                    </span>
                    {count !== null && (
                      <span className={`text-[10px] font-normal ${selectionMode === key ? 'text-blue-500' : 'text-gray-400'}`}>
                        {count} {count === 1 ? 'pag.' : 'pags.'}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Detected pages summary */}
              {selectionMode === 'detected' && (
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-1">
                  {lowTextPages.length > 0 ? (
                    <>
                      <p className="text-xs text-gray-600">
                        {lowTextPages.length} {lowTextPages.length === 1 ? 'pagina detectada com' : 'paginas detectadas com'} pouco texto
                      </p>
                      <p className="text-[11px] text-gray-400 leading-relaxed break-words">
                        {lowTextPages.slice(0, 12).join(', ')}{lowTextPages.length > 12 ? ` ... e mais ${lowTextPages.length - 12}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Nenhuma pagina com baixa densidade de texto encontrada. Use "Todas" para processar o documento inteiro.
                    </p>
                  )}
                  {documentStatus?.hasOcrContent && (
                    <div className="flex items-center gap-1.5 text-green-700 pt-0.5">
                      <CheckCircle size={11} />
                      <span className="text-[11px]">Documento ja possui conteudo OCR</span>
                    </div>
                  )}
                </div>
              )}

              {/* All pages summary */}
              {selectionMode === 'all' && (
                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-600">
                    Todas as {totalPages} paginas do documento serao processadas.
                  </p>
                </div>
              )}

              {/* Manual input */}
              {selectionMode === 'manual' && (
                <div className="space-y-2">
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-2">
                    <label className="block text-xs text-gray-600">
                      Informe paginas isoladas ou intervalos separados por virgula
                    </label>
                    <input
                      type="text"
                      value={manualInput}
                      onChange={handleManualInputChange}
                      placeholder="Ex: 1, 3-5, 10, 15-20"
                      className={`w-full px-3 py-1.5 text-sm border rounded-md outline-none transition-colors ${
                        inputError ?? parseError
                          ? 'border-red-400 focus:border-red-500 bg-red-50'
                          : 'border-gray-300 focus:border-blue-400 bg-white'
                      }`}
                    />
                    {(inputError ?? parseError) && (
                      <p className="text-xs text-red-600 flex items-start gap-1">
                        <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
                        {inputError ?? parseError}
                      </p>
                    )}
                    {!inputError && !parseError && parsedPages.length > 0 && (
                      <p className="text-[11px] text-blue-600">
                        {parsedPages.length} {parsedPages.length === 1 ? 'pagina selecionada' : 'paginas selecionadas'}: {parsedPages.slice(0, 10).join(', ')}{parsedPages.length > 10 ? ` ...` : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 px-1">
                    Documento com {totalPages} paginas no total.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {(isRunning || isDone) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  {isRunning ? progressStatusLabel : 'Concluido'}
                  {progress && isRunning ? ` — Pagina ${progress.currentPage} de ${progress.totalPages}` : ''}
                </span>
                <span className="font-medium">{isDone ? '100' : progressPercent}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${isDone ? 100 : progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {isRunning && <Loader size={14} className="text-blue-500 animate-spin flex-shrink-0" />}
            {isDone && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
            {isError && <AlertCircle size={14} className="text-red-500 flex-shrink-0" />}
            <span className={`${isError ? 'text-red-600' : isDone ? 'text-green-700' : 'text-gray-500'}`}>
              {isError ? (error ?? 'Ocorreu um erro') : statusLabel[status]}
            </span>
          </div>

          {isDone && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
              O texto reconhecido foi salvo e estara disponivel na busca do documento.
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">
            OCR processado localmente via Tesseract (pt-BR). O primeiro uso baixa o modelo de linguagem (~40 MB).
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-100">
          {isRunning ? (
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Cancelar
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Fechar
              </button>
              {canStart && (
                <button
                  onClick={handleStart}
                  disabled={
                    selectionMode === 'manual'
                      ? (manualInput.trim() === '' || parseError !== null || parsedPages.length === 0)
                      : effectivePages.length === 0
                  }
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ScanLine size={13} />
                  {selectionMode === 'manual' && parsedPages.length > 0
                    ? `Processar ${parsedPages.length} ${parsedPages.length === 1 ? 'pagina' : 'paginas'}`
                    : selectionMode === 'all'
                    ? `Processar ${totalPages} paginas`
                    : lowTextPages.length > 0
                    ? `Processar ${lowTextPages.length} ${lowTextPages.length === 1 ? 'pagina' : 'paginas'}`
                    : 'Processar'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OcrProgressModal;
