import React, { useState, useEffect, useCallback } from 'react';
import RichTextEditor from './RichTextEditor';
import logger from '../../utils/logger';
import { Save, X, PenLine } from 'lucide-react';
import { useDraggablePanel } from '../../hooks/useDraggablePanel';

interface ExpandedTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  title: string;
  initialContent: string;
  dataField?: string;
  placeholder?: string;
  maxLength?: number;
}

const ExpandedTextModal: React.FC<ExpandedTextModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  initialContent,
  dataField,
  placeholder = 'Digite o conteúdo...',
  maxLength
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const { panelRef, style, onMouseDown } = useDraggablePanel();

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent, title, dataField]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const hasChanges = useCallback(() => {
    return content !== initialContent;
  }, [content, initialContent]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar conteúdo no modal expandido',
        error as Error,
        'ExpandedTextModal - handleSave',
        { title, dataField, contentLength: content.length }
      );
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, title, dataField]);

  const handleSaveRef = React.useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  if (!isOpen) return null;

  const charCount = content.length;
  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
      <div
        ref={panelRef}
        style={style}
        className="pointer-events-auto w-[780px] bg-white shadow-2xl flex flex-col border border-gray-200 rounded-xl max-h-[calc(100vh-3rem)] overflow-hidden relative"
      >
        <div
          className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-blue-100 bg-blue-50 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onMouseDown}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <div className="w-8 h-1 rounded-full bg-blue-200" />
          </div>

          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                <PenLine size={11} />
                Editor expandido
              </span>
              {hasChanges() && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Alterações não salvas
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
            <p className="text-xs text-blue-500 mt-0.5 select-none">
              <kbd className="font-mono bg-blue-100 border border-blue-200 px-1 py-0.5 rounded text-[10px]">Esc</kbd>
              {' '}fechar{' '}
              <span className="mx-1 text-blue-300">·</span>
              <kbd className="font-mono bg-blue-100 border border-blue-200 px-1 py-0.5 rounded text-[10px]">Ctrl+S</kbd>
              {' '}salvar
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-blue-100 rounded-lg transition-colors"
            title="Fechar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 overflow-hidden expanded-editor-area">
          <RichTextEditor
            label=""
            placeholder={placeholder}
            value={content}
            onChange={handleContentChange}
            rows={22}
            className="h-full"
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 rounded-b-xl">
          <div className="flex items-center justify-between">
            <span className={`text-xs tabular-nums ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
              {charCount}{maxLength !== undefined ? ` / ${maxLength}` : ''} {charCount === 1 ? 'caractere' : 'caracteres'}
              {isOverLimit && <span className="ml-1.5">— limite excedido</span>}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges() || isOverLimit}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .expanded-editor-area .ql-container {
          min-height: 340px;
          max-height: calc(100vh - 280px);
          overflow-y: auto;
        }
        .expanded-editor-area .ql-editor {
          min-height: 340px;
          font-size: 15px;
          line-height: 1.65;
          padding: 16px 18px;
        }
        .expanded-editor-area .ql-editor.ql-blank::before {
          font-size: 15px;
        }
      `}</style>
    </div>
  );
};

export default ExpandedTextModal;
