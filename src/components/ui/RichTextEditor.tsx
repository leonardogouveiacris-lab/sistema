import React, { useMemo, useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { EditorRef, InsertionField, usePDFViewer } from '../../contexts/PDFViewerContext';
import { Bold, Italic, Underline, List, ListOrdered, Link, RemoveFormatting, Maximize2 } from 'lucide-react';
import LancamentoReferencePicker from './LancamentoReferencePicker';
import { LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';
import { registerLancamentoRefBlot } from './lancamentoRefBlot';

registerLancamentoRefBlot();

interface RichTextEditorProps {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  rows?: number;
  onExpand?: () => void;
  className?: string;
  fieldType?: InsertionField;
  referenceItems?: LancamentoReferenceItem[];
  onReferenceClick?: (item: LancamentoReferenceItem) => void;
}

interface ActiveFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  list?: string;
  link?: string;
}

const ToolbarButton = ({
  onClick,
  active,
  title,
  children,
  className: extraClass = '',
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    title={title}
    className={`
      inline-flex items-center justify-center w-7 h-7 rounded text-gray-500
      transition-all duration-150 select-none
      ${active
        ? 'bg-gray-200 text-gray-900 shadow-inner'
        : 'hover:bg-gray-100 hover:text-gray-800'
      }
      ${extraClass}
    `}
  >
    {children}
  </button>
);

const RichTextEditor = forwardRef<EditorRef, RichTextEditorProps>(({
  label,
  placeholder,
  value,
  onChange,
  required = false,
  error,
  rows = 4,
  onExpand,
  className = "",
  fieldType,
  referenceItems = [],
  onReferenceClick,
}, ref) => {
  const quillRef = useRef<ReactQuill>(null);
  const { registerEditor, unregisterEditor } = usePDFViewer();
  const toolbarId = useRef(`rte-tb-${Math.random().toString(36).substr(2, 9)}`);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerIndexRef = useRef<number | null>(null);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({});
  const [isFocused, setIsFocused] = useState(false);

  const pickerOpenRef = useRef(false);
  useEffect(() => {
    pickerOpenRef.current = pickerOpen;
  }, [pickerOpen]);

  const referenceItemsRef = useRef(referenceItems);
  useEffect(() => {
    referenceItemsRef.current = referenceItems;
  }, [referenceItems]);

  const onReferenceClickRef = useRef(onReferenceClick);
  useEffect(() => {
    onReferenceClickRef.current = onReferenceClick;
  }, [onReferenceClick]);

  const modules = useMemo(() => ({
    toolbar: `#${toolbarId.current}`,
  }), []);

  const formats = useMemo(() => [
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link',
    'lancamentoRef',
  ], []);

  const refreshFormats = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (selection) {
      const fmt = editor.getFormat(selection) as ActiveFormats;
      setActiveFormats(fmt);
    }
  }, []);

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const onSelChange = () => refreshFormats();
    const onTextChange = () => refreshFormats();
    editor.on('selection-change', onSelChange);
    editor.on('text-change', onTextChange);
    return () => {
      editor.off('selection-change', onSelChange);
      editor.off('text-change', onTextChange);
    };
  }, [refreshFormats]);

  const toggleFormat = useCallback((format: string, value?: string) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection(true);
    if (!selection) return;
    const current = editor.getFormat(selection) as Record<string, unknown>;
    if (value) {
      editor.format(format, current[format] === value ? false : value, 'user');
    } else {
      editor.format(format, !current[format], 'user');
    }
    refreshFormats();
  }, [refreshFormats]);

  const triggerLink = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection(true);
    if (!selection) return;
    const current = editor.getFormat(selection) as Record<string, unknown>;
    if (current.link) {
      editor.format('link', false, 'user');
    } else {
      const url = prompt('URL do link:');
      if (url) editor.format('link', url, 'user');
    }
    refreshFormats();
  }, [refreshFormats]);

  const triggerClean = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection(true);
    if (!selection) return;
    editor.removeFormat(selection.index, selection.length, 'user');
    refreshFormats();
  }, [refreshFormats]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return;
      const selection = editor.getSelection();
      const index = selection ? selection.index : editor.getLength();
      editor.insertText(index, text, 'user');
      editor.setSelection(index + text.length, 0);
      const newContent = editor.root.innerHTML;
      onChange(newContent);
    },
    focus: () => {
      quillRef.current?.focus();
    }
  }), [onChange]);

  useEffect(() => {
    if (!fieldType) return;

    const editorRef: EditorRef = {
      insertText: (text: string) => {
        const editor = quillRef.current?.getEditor();
        if (!editor) return;
        const selection = editor.getSelection();
        const index = selection ? selection.index : editor.getLength();
        editor.insertText(index, text, 'user');
        editor.setSelection(index + text.length, 0);
        const newContent = editor.root.innerHTML;
        onChange(newContent);
      },
      focus: () => {
        quillRef.current?.focus();
      }
    };

    registerEditor(fieldType, editorRef);
    return () => { unregisterEditor(fieldType); };
  }, [fieldType, registerEditor, unregisterEditor, onChange]);

  const getCaretRect = useCallback((): DOMRect | null => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return null;
    const selection = editor.getSelection();
    const index = selection ? selection.index : 0;
    const bounds = editor.getBounds(index);
    if (!bounds) return null;
    const editorEl = editor.root;
    const editorRect = editorEl.getBoundingClientRect();
    return new DOMRect(
      editorRect.left + bounds.left,
      editorRect.top + bounds.top,
      bounds.width || 8,
      bounds.height || 16,
    );
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerQuery('');
    triggerIndexRef.current = null;
  }, []);

  const openPicker = useCallback((triggerIndex: number) => {
    triggerIndexRef.current = triggerIndex;
    setPickerQuery('');
    const rect = getCaretRect();
    setAnchorRect(rect ?? (() => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return null;
      return editor.root.getBoundingClientRect();
    })());
    setPickerOpen(true);
  }, [getCaretRect]);

  const closePickerRef = useRef(closePicker);
  useEffect(() => { closePickerRef.current = closePicker; }, [closePicker]);

  const openPickerRef = useRef(openPicker);
  useEffect(() => { openPickerRef.current = openPicker; }, [openPicker]);

  const getCaretRectRef = useRef(getCaretRect);
  useEffect(() => { getCaretRectRef.current = getCaretRect; }, [getCaretRect]);

  const handleReferenceSelectRef = useRef<(item: LancamentoReferenceItem) => void>(() => {});

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (pickerOpenRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          closePickerRef.current();
        }
        return;
      }

      if (e.key === '=' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!referenceItemsRef.current.length) return;
        const selection = editor.getSelection();
        if (selection) {
          e.preventDefault();
          openPickerRef.current(selection.index);
        }
      }
    };

    const handleTextChange = () => {
      if (!pickerOpenRef.current || triggerIndexRef.current === null) return;

      const selection = editor.getSelection();
      if (!selection) {
        closePickerRef.current();
        return;
      }

      const currentIndex = selection.index;
      const triggerIdx = triggerIndexRef.current;

      if (currentIndex < triggerIdx) {
        closePickerRef.current();
        return;
      }

      const text = editor.getText(triggerIdx, currentIndex - triggerIdx);
      setPickerQuery(text);
      const rect = getCaretRectRef.current();
      if (rect) setAnchorRect(rect);
    };

    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const chip = target.closest('[data-ref="lancamento"]') as HTMLElement | null;
      if (!chip) return;
      const id = chip.getAttribute('data-id');
      if (!id || !onReferenceClickRef.current) return;
      const item = referenceItemsRef.current.find(r => r.id === id);
      if (item) {
        e.preventDefault();
        e.stopPropagation();
        onReferenceClickRef.current(item);
      }
    };

    editor.root.addEventListener('keydown', handleKeyDown, true);
    editor.root.addEventListener('click', handleEditorClick);
    editor.on('text-change', handleTextChange);

    return () => {
      editor.root.removeEventListener('keydown', handleKeyDown, true);
      editor.root.removeEventListener('click', handleEditorClick);
      editor.off('text-change', handleTextChange);
    };
  }, []);

  const handleReferenceSelect = useCallback((item: LancamentoReferenceItem) => {
    const editor = quillRef.current?.getEditor();
    if (!editor || triggerIndexRef.current === null) {
      closePicker();
      return;
    }

    const triggerIdx = triggerIndexRef.current;
    const selection = editor.getSelection();
    const currentIdx = selection ? selection.index : triggerIdx;
    const typedLength = currentIdx - triggerIdx;

    editor.deleteText(triggerIdx, typedLength, 'user');

    editor.insertEmbed(triggerIdx, 'lancamentoRef', {
      id: item.id,
      type: item.type,
      label: item.label,
      sublabel: item.sublabel,
      paginaVinculada: item.paginaVinculada,
      tableColumnLetter: item.tableColumnLetter,
      tableName: item.tableName,
    }, 'user');

    editor.insertText(triggerIdx + 1, ' ', 'user');
    editor.setSelection(triggerIdx + 2, 0);

    setTimeout(() => {
      const newContent = editor.root.innerHTML;
      onChange(newContent);
    }, 0);

    closePicker();
  }, [onChange, closePicker]);

  useEffect(() => {
    handleReferenceSelectRef.current = handleReferenceSelect;
  }, [handleReferenceSelect]);

  const borderColor = error ? 'border-red-400' : isFocused ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200';

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={`rte-modern rounded-lg border bg-white transition-all duration-200 overflow-hidden ${borderColor}`}>
        <div
          id={toolbarId.current}
          className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-100"
        >
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => toggleFormat('bold')}
              active={!!activeFormats.bold}
              title="Negrito (Ctrl+B)"
            >
              <Bold size={13} strokeWidth={2.5} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => toggleFormat('italic')}
              active={!!activeFormats.italic}
              title="Itálico (Ctrl+I)"
            >
              <Italic size={13} strokeWidth={2.5} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => toggleFormat('underline')}
              active={!!activeFormats.underline}
              title="Sublinhado (Ctrl+U)"
            >
              <Underline size={13} strokeWidth={2.5} />
            </ToolbarButton>
          </div>

          <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0" />

          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => toggleFormat('list', 'ordered')}
              active={activeFormats.list === 'ordered'}
              title="Lista numerada"
            >
              <ListOrdered size={13} strokeWidth={2.5} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => toggleFormat('list', 'bullet')}
              active={activeFormats.list === 'bullet'}
              title="Lista com marcadores"
            >
              <List size={13} strokeWidth={2.5} />
            </ToolbarButton>
          </div>

          <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0" />

          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={triggerLink}
              active={!!activeFormats.link}
              title="Inserir link"
            >
              <Link size={13} strokeWidth={2.5} />
            </ToolbarButton>
            <ToolbarButton
              onClick={triggerClean}
              title="Remover formatação"
            >
              <RemoveFormatting size={13} strokeWidth={2.5} />
            </ToolbarButton>
          </div>

          {onExpand && (
            <>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onExpand}
                title="Expandir para tela cheia"
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-500 rounded hover:bg-gray-200 hover:text-gray-700 transition-colors duration-150"
              >
                <Maximize2 size={11} />
                <span>Expandir</span>
              </button>
            </>
          )}
        </div>

        <div
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        >
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            modules={modules}
            formats={formats}
            preserveWhitespace={true}
          />
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-xs mt-1" role="alert">
          {error}
        </p>
      )}

      {pickerOpen && (
        <LancamentoReferencePicker
          items={referenceItems}
          query={pickerQuery}
          anchorRect={anchorRect}
          onSelect={handleReferenceSelect}
          onClose={closePicker}
        />
      )}

      <style>{`
        .rte-modern .ql-toolbar.ql-snow {
          display: none !important;
        }
        .rte-modern .ql-container.ql-snow {
          border: none !important;
          font-family: inherit;
          font-size: 0.875rem;
          position: relative;
          z-index: 0;
          min-height: ${rows * 1.5 * 1.75}em;
          max-height: ${rows * 3 * 1.75}em;
          overflow-y: auto;
        }
        .rte-modern .ql-editor {
          min-height: ${rows * 1.2 * 1.75}em;
          padding: 10px 14px;
          text-align: justify;
          line-height: 1.6;
          color: #111827;
          font-size: 0.875rem;
        }
        .rte-modern .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
          left: 14px;
          right: 14px;
        }
        .rte-modern .ql-editor p,
        .rte-modern .ql-editor li {
          text-align: justify;
        }
        .rte-modern .ql-editor a {
          color: #2563eb;
          text-decoration: underline;
        }
        .rte-modern .ql-editor ol,
        .rte-modern .ql-editor ul {
          padding-left: 1.5em;
        }
        .lancamento-ref-chip {
          display: inline;
          padding: 1px 4px;
          border-radius: 4px;
          font-size: inherit;
          font-weight: inherit;
          cursor: pointer;
          text-decoration: none;
          user-select: none;
          white-space: normal;
          word-break: break-word;
          background: transparent;
          color: inherit;
          border: none;
        }
        .lancamento-ref-chip[data-type="verba"] {
          background: transparent;
          color: inherit;
          border: none;
        }
        .lancamento-ref-chip[data-type="documento"] {
          background: transparent;
          color: inherit;
          border: none;
        }
        .lancamento-ref-chip[data-type="decisao"] {
          background: transparent;
          color: inherit;
          border: none;
        }
        .lancamento-ref-chip[data-type="tabela"] {
          background: transparent;
          color: inherit;
          border: none;
        }
        .lancamento-ref-chip:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default React.memo(RichTextEditor);
