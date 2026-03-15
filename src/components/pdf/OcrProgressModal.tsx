import React from 'react';
import { X, ScanLine, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import type { OcrState } from '../../hooks/usePdfOcr';

interface OcrProgressModalProps {
  isOpen: boolean;
  ocrState: OcrState;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}

const statusLabel: Record<OcrState['status'], string> = {
  idle: 'Pronto',
  detecting: 'Detectando paginas...',
  running: 'Executando OCR...',
  saving: 'Salvando resultados...',
  done: 'OCR concluido',
  error: 'Erro no OCR',
};

const OcrProgressModal: React.FC<OcrProgressModalProps> = ({
  isOpen,
  ocrState,
  onStart,
  onCancel,
  onClose,
}) => {
  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <ScanLine size={18} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">OCR - Reconhecimento de Texto</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Summary info */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>Paginas com pouco texto detectadas</span>
              <span className="font-medium text-gray-900">{lowTextPages.length}</span>
            </div>
            {documentStatus?.hasOcrContent && (
              <div className="flex items-center gap-1.5 text-green-700">
                <CheckCircle size={13} />
                <span className="text-xs">Este documento ja possui conteudo OCR</span>
              </div>
            )}
            {lowTextPages.length > 0 && (
              <p className="text-xs text-gray-500 pt-0.5">
                Paginas: {lowTextPages.slice(0, 8).join(', ')}{lowTextPages.length > 8 ? ` e mais ${lowTextPages.length - 8}` : ''}
              </p>
            )}
            {lowTextPages.length === 0 && !isRunning && status === 'idle' && (
              <p className="text-xs text-gray-500">
                Nenhuma pagina com baixa densidade de texto detectada. Voce pode executar o OCR em todo o documento.
              </p>
            )}
          </div>

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
            <span className={`${isError ? 'text-red-600' : isDone ? 'text-green-700' : 'text-gray-600'}`}>
              {isError ? error ?? 'Ocorreu um erro' : statusLabel[status]}
            </span>
          </div>

          {isDone && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
              O texto reconhecido foi salvo e estara disponivel na busca do documento.
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">
            O OCR e processado localmente no navegador usando o modelo Tesseract otimizado para portugues (pt-BR).
            O primeiro uso pode demorar alguns minutos para baixar o modelo de linguagem.
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
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Fechar
              </button>
              {canStart && (
                <button
                  onClick={onStart}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ScanLine size={13} />
                  {lowTextPages.length > 0 ? `Processar ${lowTextPages.length} paginas` : 'Processar tudo'}
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
