/**
 * TextSelectionPopup - Popup contextual para ações de texto selecionado
 *
 * Funcionalidades:
 * - Aparece próximo ao texto selecionado
 * - Posicionamento inteligente (acima/abaixo)
 * - Layout vertical em lista moderna e minimalista
 * - Ações: copiar, destacar, fundamentação e comentários
 * - Fecha automaticamente ao clicar fora ou ao rolar
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, FileText, MessageSquare, X, Highlighter } from 'lucide-react';
import { SelectionPosition } from '../../contexts/PDFViewerContext';

interface TextSelectionPopupProps {
  selectedText: string;
  position: SelectionPosition;
  onCopy: () => void;
  onInsertFundamentacao: () => void;
  onInsertComentarios: () => void;
  onHighlight?: () => void;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement>;
  hasActiveForm?: boolean;
  hasFundamentacaoField?: boolean;
}

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  selectedText,
  position,
  onCopy,
  onInsertFundamentacao,
  onInsertComentarios,
  onHighlight,
  onClose,
  containerRef,
  hasActiveForm = false,
  hasFundamentacaoField = false
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [calculatedPosition, setCalculatedPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom'; ready: boolean }>({
    top: 0,
    left: 0,
    placement: 'bottom',
    ready: false
  });

  /**
   * Calcula a melhor posição para o popup
   */
  const calculatePosition = useCallback(() => {
    if (!popupRef.current) return;

    const popup = popupRef.current;
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width || 240;
    const popupHeight = popupRect.height || 200;
    const padding = 8;

    // Obter o container de scroll (se fornecido) ou usar window
    const container = containerRef?.current;
    const containerRect = container?.getBoundingClientRect() || {
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };

    const posX = position.viewportX ?? position.x;
    const posY = position.viewportY ?? position.y;
    const selectionWidth = position.viewportWidth ?? position.width;
    const selectionHeight = position.viewportHeight ?? position.height;

    let left = posX + (selectionWidth / 2) - (popupWidth / 2);

    if (left < containerRect.left + padding) {
      left = containerRect.left + padding;
    } else if (left + popupWidth > containerRect.right - padding) {
      left = containerRect.right - popupWidth - padding;
    }

    const spaceAbove = posY - containerRect.top;
    const spaceBelow = containerRect.bottom - (posY + selectionHeight);
    const preferBottom = spaceBelow >= popupHeight + padding || spaceBelow > spaceAbove;

    let top: number;
    let placement: 'top' | 'bottom';

    if (preferBottom) {
      top = posY + selectionHeight + padding;
      placement = 'bottom';
    } else {
      top = posY - popupHeight - padding;
      placement = 'top';
    }

    setCalculatedPosition({ top, left, placement, ready: true });
  }, [position, containerRef]);

  /**
   * Recalcula posição quando necessário
   */
  useEffect(() => {
    calculatePosition();
  }, [calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const scrollTarget = containerRef?.current || window;

    document.addEventListener('mousedown', handleClickOutside);
    scrollTarget.addEventListener('scroll', handleScroll as EventListener);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      scrollTarget.removeEventListener('scroll', handleScroll as EventListener);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, containerRef]);

  const characterCount = selectedText.length;

  return (
    <div
      ref={popupRef}
      data-text-selection-popup="true"
      className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200"
      style={{
        top: `${calculatedPosition.top}px`,
        left: `${calculatedPosition.left}px`,
        width: '240px',
        visibility: calculatedPosition.ready ? 'visible' : 'hidden'
      }}
    >
      {/* Seta indicadora */}
      <div
        className={`absolute w-3 h-3 bg-white border-gray-200 transform rotate-45 ${
          calculatedPosition.placement === 'bottom'
            ? '-top-1.5 border-t border-l'
            : '-bottom-1.5 border-b border-r'
        }`}
        style={{
          left: '50%',
          marginLeft: '-6px'
        }}
      />

      {/* Header com contador e botão fechar */}
      <div className="relative flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <FileText size={14} className="text-gray-400" />
          <span className="font-medium text-gray-700">{characterCount}</span>
          <span className="text-gray-500">caracteres</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-150"
          title="Fechar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Lista de ações */}
      <div className="py-1">
        {/* Copiar */}
        <button
          onClick={onCopy}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
        >
          <Copy size={16} className="text-gray-500 flex-shrink-0" />
          <span className="font-medium">Copiar texto</span>
        </button>

        {/* Destacar (se disponível) */}
        {onHighlight && (
          <>
            <div className="h-px bg-gray-100 mx-2" />
            <button
              onClick={onHighlight}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <Highlighter size={16} className="text-yellow-500 flex-shrink-0" />
              <span className="font-medium">Destacar</span>
            </button>
          </>
        )}

        {/* Fundamentação - só aparece quando há formulário de Verba ativo */}
        {hasActiveForm && hasFundamentacaoField && (
          <>
            <div className="h-px bg-gray-100 mx-2" />
            <button
              onClick={onInsertFundamentacao}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <FileText size={16} className="text-blue-600 flex-shrink-0" />
              <span className="font-medium">Fundamentação</span>
            </button>
          </>
        )}

        {/* Comentários - aparece quando há qualquer formulário ativo */}
        {hasActiveForm && (
          <>
            <div className="h-px bg-gray-100 mx-2" />
            <button
              onClick={onInsertComentarios}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <MessageSquare size={16} className="text-green-600 flex-shrink-0" />
              <span className="font-medium">Comentários</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TextSelectionPopup;
