import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Trash2, ArrowRight, Square, Palette, Spline } from 'lucide-react';
import { PDFComment, CommentColor, COMMENT_COLORS, ConnectorType } from '../../types/PDFComment';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import * as PDFCommentsService from '../../services/pdfComments.service';
import logger from '../../utils/logger';
import { useLancamentosForReference } from '../../hooks/useLancamentosForReference';
import { useNavigateToReference } from '../../hooks/useNavigateToReference';
import { LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';
import RichTextEditor from '../ui/RichTextEditor';
import { registerLancamentoRefBlot } from '../ui/lancamentoRefBlot';

registerLancamentoRefBlot();

const LEGACY_REF_PATTERN = /\[=(\w+):([^:]+):([^\]]+)\]/g;

function legacyToHtml(raw: string): string {
  if (!raw || !raw.includes('[=')) return raw;
  return raw.replace(LEGACY_REF_PATTERN, (_match, refType, id, label) => {
    const icon = refType === 'verba' ? '⬡' : refType === 'decisao' ? '◈' : refType === 'tabela' ? '⊞' : '⬜';
    return `<span class="lancamento-ref-chip" data-ref="lancamento" data-id="${id}" data-type="${refType}" data-label="${label.replace(/"/g, '&quot;')}" contenteditable="false">${icon} ${label}</span>`;
  });
}

function normalizeContent(raw: string): string {
  if (!raw) return '';
  if (raw.includes('[=')) return legacyToHtml(raw);
  return raw;
}

interface CommentBalloonProps {
  comment: PDFComment;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  onStartDrawConnector: (commentId: string, type: ConnectorType) => void;
  processId?: string;
}

const COLOR_OPTIONS: CommentColor[] = ['yellow', 'green', 'blue', 'pink', 'orange', 'red'];

const POPUP_WIDTH = 320;

const CommentBalloon: React.FC<CommentBalloonProps> = ({
  comment,
  scale,
  pageWidth,
  pageHeight,
  onStartDrawConnector,
  processId = ''
}) => {
  const { updateComment, removeComment, selectComment, state } = usePDFViewer();
  const [isExpanded, setIsExpanded] = useState(!comment.isMinimized);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(() => normalizeContent(comment.content));
  const [editContent, setEditContent] = useState(() => normalizeContent(comment.content));
  const [showConnectorDropdown, setShowConnectorDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const referenceItems = useLancamentosForReference(processId);
  const navigateToReference = useNavigateToReference(processId);

  const handleReferenceClick = useCallback((item: LancamentoReferenceItem) => {
    navigateToReference(item);
  }, [navigateToReference]);

  const handleReadonlyChipClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const chip = (e.target as HTMLElement).closest('[data-ref="lancamento"]') as HTMLElement | null;
    if (chip) {
      const id = chip.getAttribute('data-id');
      if (id) {
        const item = referenceItems.find(r => r.id === id);
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          navigateToReference(item);
          return;
        }
      }
    }
    setEditContent(content);
    setIsEditing(true);
  }, [referenceItems, navigateToReference, content]);

  const balloonRef = useRef<HTMLDivElement>(null);
  const connectorDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const isSelected = state.selectedCommentId === comment.id;

  const posX = comment.positionX * scale;
  const posY = comment.positionY * scale;

  useLayoutEffect(() => {
    if (isExpanded) applyPopupCoords(true);
  }, [posX, posY]);

  useEffect(() => {
    if (isSelected && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isSelected]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (connectorDropdownRef.current && !connectorDropdownRef.current.contains(e.target as Node)) {
        setShowConnectorDropdown(false);
      }
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(e.target as Node)) {
        setShowColorDropdown(false);
      }
    };

    if (showConnectorDropdown || showColorDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConnectorDropdown, showColorDropdown]);

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) {
      setIsExpanded(!isExpanded);
      selectComment(isExpanded ? null : comment.id);
    }
  };

  const handleSave = async () => {
    try {
      await PDFCommentsService.updateComment(comment.id, { content: editContent });
      updateComment(comment.id, { content: editContent });
      setContent(editContent);
      setIsEditing(false);
    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar comentário no PDF',
        error as Error,
        'CommentBalloon.handleSave',
        { commentId: comment.id }
      );
    }
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleClose = async () => {
    if (isEditing && editContent !== content) {
      await handleSave();
    }
    setIsExpanded(false);
    selectComment(null);
    try {
      await PDFCommentsService.updateComment(comment.id, { isMinimized: true });
      updateComment(comment.id, { isMinimized: true });
    } catch (error) {
      logger.errorWithException(
        'Falha ao minimizar comentário no PDF',
        error as Error,
        'CommentBalloon.handleClose',
        { commentId: comment.id, isMinimized: true }
      );
    }
  };

  const handleDelete = async () => {
    try {
      await PDFCommentsService.deleteComment(comment.id);
      removeComment(comment.id);
    } catch (error) {
      logger.errorWithException(
        'Falha ao excluir comentário no PDF',
        error as Error,
        'CommentBalloon.handleDelete',
        { commentId: comment.id }
      );
    }
  };

  const handleColorChange = async (color: CommentColor) => {
    try {
      await PDFCommentsService.updateComment(comment.id, { color });
      updateComment(comment.id, { color });
      setShowColorDropdown(false);
    } catch (error) {
      logger.errorWithException(
        'Falha ao atualizar cor do comentário no PDF',
        error as Error,
        'CommentBalloon.handleColorChange',
        { commentId: comment.id, color }
      );
    }
  };

  const handleStartArrow = () => {
    onStartDrawConnector(comment.id, 'arrow');
    setShowConnectorDropdown(false);
  };

  const handleStartHighlightBox = () => {
    onStartDrawConnector(comment.id, 'highlightbox');
    setShowConnectorDropdown(false);
  };

  const popupCoordsRef = useRef<{ top?: number; bottom?: number; left: number; visible: boolean }>({ left: 0, visible: false });
  const [, forcePopupRender] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPopupCoords = useCallback((direct: boolean) => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let scrollEl: Element | null = iconRef.current.parentElement;
    while (scrollEl && scrollEl !== document.documentElement) {
      const st = window.getComputedStyle(scrollEl);
      const oy = st.overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      scrollEl = scrollEl.parentElement;
    }
    const containerRect = scrollEl
      ? scrollEl.getBoundingClientRect()
      : { top: 0, bottom: viewportHeight, left: 0, right: viewportWidth };
    const iconVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom &&
                        rect.right > containerRect.left && rect.left < containerRect.right;

    const idealLeft = rect.left + rect.width / 2 - POPUP_WIDTH / 2;
    const left = Math.max(8, Math.min(idealLeft, viewportWidth - POPUP_WIDTH - 8));
    const frameBoundaryBottom = Math.min(viewportHeight, containerRect.bottom);
    const frameBoundaryTop = Math.max(0, containerRect.top);

    const spaceBelow = frameBoundaryBottom - rect.bottom - 6;
    const spaceAbove = rect.top - frameBoundaryTop - 6;
    const flipped = spaceBelow < 60 && spaceAbove > spaceBelow;
    const visible = iconVisible && (flipped ? spaceAbove > 0 : spaceBelow > 0);

    const newTop = flipped ? undefined : rect.bottom + 6;
    const newBottom = flipped ? viewportHeight - rect.top + 6 : undefined;

    popupCoordsRef.current = { top: newTop, bottom: newBottom, left, visible };

    if (direct && popupRef.current) {
      popupRef.current.style.top = newTop !== undefined ? `${newTop}px` : '';
      popupRef.current.style.bottom = newBottom !== undefined ? `${newBottom}px` : '';
      popupRef.current.style.left = `${left}px`;
      popupRef.current.style.visibility = visible ? 'visible' : 'hidden';
    } else {
      forcePopupRender(n => n + 1);
    }
  }, []);

  useLayoutEffect(() => {
    if (!isExpanded) {
      popupCoordsRef.current = { ...popupCoordsRef.current, visible: false };
      if (showTimeoutRef.current !== null) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
      return;
    }

    if (popupRef.current) {
      popupRef.current.style.visibility = 'hidden';
    }

    showTimeoutRef.current = setTimeout(() => {
      showTimeoutRef.current = null;
      applyPopupCoords(true);
    }, 350);

    return () => {
      if (showTimeoutRef.current !== null) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
    };
  }, [isExpanded, applyPopupCoords]);

  useEffect(() => {
    if (!isExpanded) return;
    const onUpdate = () => applyPopupCoords(true);
    window.addEventListener('scroll', onUpdate, true);
    window.addEventListener('resize', onUpdate);
    return () => {
      window.removeEventListener('scroll', onUpdate, true);
      window.removeEventListener('resize', onUpdate);
    };
  }, [isExpanded, applyPopupCoords]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, [contenteditable], input, .ql-toolbar, .ql-editor')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const rect = balloonRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const latestPositionRef = useRef({ x: comment.positionX, y: comment.positionY });

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!balloonRef.current) return;

    const pageContainer = balloonRef.current.parentElement?.parentElement;
    if (!pageContainer) return;

    const parentRect = pageContainer.getBoundingClientRect();
    const newX = (e.clientX - parentRect.left - dragOffset.x) / scale;
    const newY = (e.clientY - parentRect.top - dragOffset.y) / scale;

    const maxX = parentRect.width / scale;
    const maxY = parentRect.height / scale;
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));

    latestPositionRef.current = { x: clampedX, y: clampedY };
    updateComment(comment.id, { positionX: clampedX, positionY: clampedY });

    if (isExpanded) applyPopupCoords(true);
  }, [dragOffset, scale, pageWidth, pageHeight, comment.id, updateComment, isExpanded, applyPopupCoords]);

  const handleDragEnd = useCallback(async () => {
    setIsDragging(false);
    const { x, y } = latestPositionRef.current;
    try {
      await PDFCommentsService.updateComment(comment.id, {
        positionX: x,
        positionY: y
      });
    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar posição do comentário no PDF',
        error as Error,
        'CommentBalloon.handleDragEnd',
        { commentId: comment.id, positionX: x, positionY: y }
      );
    }
  }, [comment.id]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  const colorConfig = COMMENT_COLORS[comment.color];
  const formattedDate = new Date(comment.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      ref={balloonRef}
      className="absolute z-30"
      style={{
        left: posX,
        top: posY,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleDragStart}
    >
      <div
        ref={iconRef}
        onClick={handleIconClick}
        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md hover:shadow-lg ${colorConfig.bg} ${colorConfig.border} border-2 ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
        }`}
      >
        <MessageCircle size={16} className={colorConfig.icon} />
      </div>

      {isExpanded && createPortal(
        <div
          ref={popupRef}
          className={`fixed bg-white rounded-xl shadow-2xl border ${colorConfig.border} z-[9999] flex flex-col`}
          style={{
            top: popupCoordsRef.current.top,
            bottom: popupCoordsRef.current.bottom,
            left: popupCoordsRef.current.left,
            width: POPUP_WIDTH,
            visibility: popupCoordsRef.current.visible ? 'visible' : 'hidden',
            transition: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={`px-3 py-2 ${colorConfig.bg} flex items-center justify-between rounded-t-xl shrink-0`}>
            <span className="text-xs text-gray-500 font-medium">{formattedDate}</span>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white/60 rounded-md transition-colors"
            >
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          <div className="p-3 flex-1 min-h-0">
            {isEditing ? (
              <RichTextEditor
                placeholder="Adicionar comentário..."
                value={editContent}
                onChange={setEditContent}
                rows={3}
                referenceItems={referenceItems}
                onReferenceClick={handleReferenceClick}
              />
            ) : content && content !== '<p><br></p>' ? (
              <div
                onClick={handleReadonlyChipClick}
                className="min-h-[80px] max-h-48 overflow-y-auto p-2.5 text-sm rounded-lg transition-colors leading-relaxed cursor-text text-gray-700 bg-gray-50 hover:bg-gray-100 ql-editor-readonly text-justify w-full"
                style={{ wordBreak: 'break-word', overflowX: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <div
                onClick={() => { setEditContent(content); setIsEditing(true); }}
                className="min-h-[80px] p-2.5 text-sm rounded-lg bg-gray-50 hover:bg-gray-100 cursor-text flex items-start"
              >
                <span className="text-gray-400 italic">Clique para adicionar comentário...</span>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="px-3 pb-3 flex justify-end gap-2 shrink-0">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Salvar
              </button>
            </div>
          ) : (
            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-center gap-1 shrink-0">
              <div className="relative" ref={connectorDropdownRef}>
                <button
                  onClick={() => setShowConnectorDropdown(!showConnectorDropdown)}
                  className={`p-2 rounded-lg transition-colors ${showConnectorDropdown ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title="Adicionar conector"
                >
                  <Spline size={15} />
                </button>
                {showConnectorDropdown && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-xl border py-1 min-w-[130px] z-[100]">
                    <button
                      onClick={handleStartArrow}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <ArrowRight size={14} />
                      Seta
                    </button>
                    <button
                      onClick={handleStartHighlightBox}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Square size={14} />
                      Destaque
                    </button>
                  </div>
                )}
              </div>

              <div className="relative" ref={colorDropdownRef}>
                <button
                  onClick={() => setShowColorDropdown(!showColorDropdown)}
                  className={`p-2 rounded-lg transition-colors ${showColorDropdown ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title="Mudar cor"
                >
                  <Palette size={15} />
                </button>
                {showColorDropdown && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-xl border p-2 z-[100]">
                    <div className="flex gap-1.5">
                      {COLOR_OPTIONS.map(color => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className={`w-6 h-6 rounded-full ${COMMENT_COLORS[color].bg} ${COMMENT_COLORS[color].border} border-2 hover:scale-110 transition-transform ${
                            comment.color === color ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                          }`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir comentário"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(CommentBalloon);
