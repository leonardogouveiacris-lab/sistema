import React, { useMemo, useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { EditorRef, InsertionField, usePDFViewer } from '../../contexts/PDFViewerContext';
import { Maximize2 } from 'lucide-react';
import LancamentoReferencePicker from './LancamentoReferencePicker';
import { LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';

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
}

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
}, ref) => {
  const quillRef = useRef<ReactQuill>(null);
  const { registerEditor, unregisterEditor } = usePDFViewer();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerIndexRef = useRef<number | null>(null);

  const pickerOpenRef = useRef(false);
  useEffect(() => {
    pickerOpenRef.current = pickerOpen;
  }, [pickerOpen]);

  const referenceItemsRef = useRef(referenceItems);
  useEffect(() => {
    referenceItemsRef.current = referenceItems;
  }, [referenceItems]);

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean']
    ],
  }), []);

  const formats = useMemo(() => [
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link'
  ], []);

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

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (pickerOpenRef.current) {
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

    editor.root.addEventListener('keydown', handleKeyDown, true);
    editor.on('text-change', handleTextChange);

    return () => {
      editor.root.removeEventListener('keydown', handleKeyDown, true);
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

    const chipHtml = buildChipHtml(item);

    const delta = editor.clipboard.convert({ html: chipHtml + '&nbsp;' });
    editor.updateContents(
      new (editor.constructor as any).import('delta')()
        .retain(triggerIdx)
        .concat(delta),
      'user'
    );

    const newLen = triggerIdx + delta.length();
    editor.setSelection(newLen, 0);

    setTimeout(() => {
      const newContent = editor.root.innerHTML;
      onChange(newContent);
    }, 0);

    closePicker();
  }, [onChange, closePicker]);

  const containerClasses = useMemo(() => {
    const baseClasses = 'border rounded-md transition-all duration-200';
    const errorClasses = error ? 'border-red-500' : 'border-gray-300';
    return `${baseClasses} ${errorClasses} ${className}`.trim();
  }, [error, className]);

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200"
              title="Expandir editor para tela cheia"
            >
              <Maximize2 size={12} />
              <span>Expandir</span>
            </button>
          )}
        </div>
      )}

      <div className={containerClasses}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          preserveWhitespace={true}
          style={{ backgroundColor: 'white' }}
        />
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
        .ql-container {
          min-height: ${rows * 1.5}em;
          max-height: ${rows * 3}em;
          overflow-y: auto;
        }
        .ql-editor {
          min-height: ${rows * 1.2}em;
          padding: 12px 15px;
        }
        .ql-toolbar {
          border-bottom: 1px solid #ccc;
          position: relative;
          z-index: 1;
        }
        .ql-container {
          position: relative;
          z-index: 0;
        }
        .lancamento-ref-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          user-select: none;
          white-space: nowrap;
        }
        .lancamento-ref-chip[data-type="verba"] {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
        }
        .lancamento-ref-chip[data-type="documento"] {
          background: #cffafe;
          color: #0e7490;
          border: 1px solid #67e8f9;
        }
        .lancamento-ref-chip[data-type="decisao"] {
          background: #fef9c3;
          color: #854d0e;
          border: 1px solid #fde047;
        }
        .lancamento-ref-chip:hover {
          filter: brightness(0.95);
        }
      `}</style>
    </div>
  );
});

function buildChipHtml(item: LancamentoReferenceItem): string {
  const icon = item.type === 'verba' ? '⬡' : item.type === 'decisao' ? '◈' : '⬜';
  const label = item.sublabel
    ? `${item.label} · ${item.sublabel}`
    : item.label;
  const page = item.paginaVinculada ? ` p.${item.paginaVinculada}` : '';
  return `<span class="lancamento-ref-chip" data-type="${item.type}" data-id="${item.id}" data-ref="lancamento" contenteditable="false">${icon} ${label}${page}</span>`;
}

RichTextEditor.displayName = 'RichTextEditor';

export default React.memo(RichTextEditor);
