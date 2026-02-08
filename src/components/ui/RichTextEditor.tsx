/**
 * Componente RichTextEditor - Editor de texto rico com normalização de colagem
 * 
 * Normaliza automaticamente texto colado apenas nos campos:
 * - Fundamentação (data-field="fundamentacao")
 * - Comentários Calculistas (data-field="comentarios")
 */

import React, { useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { EditorRef, InsertionField, usePDFViewer } from '../../contexts/PDFViewerContext';
import { Maximize2 } from 'lucide-react';

/**
 * Props do componente RichTextEditor
 */
interface RichTextEditorProps {
  label?: string;                   // Label do campo (opcional)
  placeholder: string;              // Texto de placeholder
  value: string;                   // Valor atual do editor
  onChange: (value: string) => void; // Callback para mudanças no conteúdo
  required?: boolean;              // Se o campo é obrigatório
  error?: string;                  // Mensagem de erro (se houver)
  rows?: number;                   // Número de linhas (usado para calcular altura)
  onExpand?: () => void;           // Callback para expandir o editor (opcional)
  className?: string;              // Classes CSS adicionais
  fieldType?: InsertionField;      // Tipo do campo para registro no contexto PDF
}

/**
 * Componente RichTextEditor
 */
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
  fieldType
}, ref) => {
  const quillRef = useRef<ReactQuill>(null);
  const { registerEditor, unregisterEditor } = usePDFViewer();

  /**
   * Configuração dos módulos do ReactQuill
   */
  const modules = useMemo(() => ({
    toolbar: [
      // Primeiro grupo: Formatação básica de texto
      ['bold', 'italic', 'underline'],
      
      // Segundo grupo: Listas
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      
      // Terceiro grupo: Links e limpeza
      ['link', 'clean']
    ],
  }), []);

  /**
   * Configuração dos formatos permitidos no ReactQuill
   */
  const formats = useMemo(() => [
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link'
  ], []);


  /**
   * Expõe métodos através da ref
   */
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return;

      // Obtém a posição atual do cursor
      const selection = editor.getSelection();
      const index = selection ? selection.index : editor.getLength();

      // Insere o texto na posição do cursor
      editor.insertText(index, text, 'user');

      // Move o cursor para o final do texto inserido
      editor.setSelection(index + text.length, 0);

      // Atualiza o valor através do onChange
      const newContent = editor.root.innerHTML;
      onChange(newContent);
    },
    focus: () => {
      quillRef.current?.focus();
    }
  }), [onChange]);

  /**
   * Effect para registrar/desregistrar editor no contexto PDF
   */
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

    return () => {
      unregisterEditor(fieldType);
    };
  }, [fieldType, registerEditor, unregisterEditor, onChange]);

  /**
   * Handler para mudanças no conteúdo do editor
   */
  const handleChange = (content: string) => {
    onChange(content);
  };

  /**
   * Classes CSS condicionais para o container
   */
  const containerClasses = useMemo(() => {
    const baseClasses = 'border rounded-md transition-all duration-200';
    const errorClasses = error ? 'border-red-500' : 'border-gray-300';
    
    return `${baseClasses} ${errorClasses} ${className}`.trim();
  }, [error, className]);

  return (
    <div>
      {/* Label do campo com indicador de obrigatório */}
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          
          {/* Botão de expandir (se callback fornecido) */}
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

      {/* Container do editor */}
      <div className={containerClasses}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          preserveWhitespace={true}
          style={{
            backgroundColor: 'white'
          }}
        />
      </div>

      {/* Mensagem de erro (se houver) */}
      {error && (
        <p className="text-red-500 text-xs mt-1" role="alert">
          {error}
        </p>
      )}
      
      {/* Estilos específicos para o editor */}
      <style jsx>{`
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
      `}</style>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default React.memo(RichTextEditor);