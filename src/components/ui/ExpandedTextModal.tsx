/**
 * Componente ExpandedTextModal - Modal genérico para edição de texto expandido
 * 
 * Funcionalidades:
 * - Modal responsivo para edição de texto em tela cheia
 * - Integração com RichTextEditor
 * - Suporte a normalização de texto
 * - Validação de mudanças não salvas
 * - Interface limpa e intuitiva
 */

import React, { useState, useEffect, useCallback } from 'react';
import RichTextEditor from './RichTextEditor';
import logger from '../../utils/logger';
import { Save } from 'lucide-react';

/**
 * Props do componente ExpandedTextModal
 */
interface ExpandedTextModalProps {
  isOpen: boolean;                    // Estado de abertura do modal
  onClose: () => void;               // Callback para fechar o modal
  onSave: (content: string) => void; // Callback para salvar o conteúdo
  title: string;                     // Título do modal
  initialContent: string;            // Conteúdo inicial para edição
  dataField?: string;                // Campo para normalização (opcional)
  placeholder?: string;              // Placeholder para o editor
}

/**
 * Componente ExpandedTextModal
 */
const ExpandedTextModal: React.FC<ExpandedTextModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  initialContent,
  dataField,
  placeholder = 'Digite o conteúdo...'
}) => {
  // Estado do conteúdo sendo editado
  const [content, setContent] = useState(initialContent);
  
  // Estado de carregamento durante salvamento
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Sincroniza o conteúdo quando o modal abrir ou o conteúdo inicial mudar
   */
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      
      logger.info(
        `Modal expandido aberto: "${title}"`,
        'ExpandedTextModal - useEffect',
        { 
          title, 
          dataField,
          contentLength: initialContent.length,
          hasContent: initialContent.length > 0
        }
      );
    }
  }, [isOpen, initialContent, title, dataField]);

  /**
   * Detecta se houve mudanças no conteúdo
   */
  const hasChanges = useCallback(() => {
    return content !== initialContent;
  }, [content, initialContent]);

  /**
   * Processa o salvamento do conteúdo
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    
    try {
      await onSave(content);
      
      logger.success(
        `Conteúdo salvo no modal expandido: "${title}"`,
        'ExpandedTextModal - handleSave',
        { 
          title,
          dataField,
          contentLength: content.length,
          hasChanges: hasChanges()
        }
      );
      
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
  }, [content, onSave, title, dataField, hasChanges]);

  const handleClose = useCallback(() => {
    logger.info(
      `Modal expandido fechado: "${title}"`,
      'ExpandedTextModal - handleClose',
      {
        title,
        dataField,
        contentLength: content.length
      }
    );

    onClose();
  }, [onClose, title, dataField, content.length]);

  /**
   * Lida com mudanças no conteúdo do editor
   */
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  /**
   * Lida com teclas pressionadas no modal
   * Escape: fecha o modal, Ctrl+S: salva
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [handleClose, handleSave]);

  // Não renderiza nada se o modal não estiver aberto
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop do modal */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />

      {/* Container do modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-6xl max-h-screen overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Cabeçalho do modal */}
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Editor expandido • <kbd className="text-xs bg-gray-100 px-1 rounded">Esc</kbd> para fechar • <kbd className="text-xs bg-gray-100 px-1 rounded">Ctrl+S</kbd> para salvar
                </p>
              </div>
              
              {/* Indicador de mudanças */}
              {hasChanges() && (
                <div className="flex items-center space-x-2 text-orange-600">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span className="text-sm font-medium">Alterações não salvas</span>
                </div>
              )}
              
              {/* Botão de fechar */}
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title="Fechar modal (Esc)"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
          </div>

          {/* Conteúdo do modal - Editor */}
          <div className="flex-1 p-6 overflow-hidden">
            <RichTextEditor
              label=""
              placeholder={placeholder}
              value={content}
              onChange={handleContentChange}
              rows={20}
              className="h-full"
            />
          </div>

          {/* Rodapé do modal com botões de ação */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
            <div className="flex justify-between items-center">
              {/* Informações do conteúdo */}
              <div className="text-sm text-gray-500">
                <span>{content.length} caracteres</span>
                {hasChanges() && (
                  <span className="ml-4 text-orange-600 font-medium">
                    • Alterações não salvas
                  </span>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex space-x-3">
                {/* Botão Cancelar */}
                <button
                  onClick={handleClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Cancelar
                </button>

                {/* Botão Salvar */}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges()}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin text-xs">⟳</span>
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
      </div>
    </>
  );
};

export default ExpandedTextModal;