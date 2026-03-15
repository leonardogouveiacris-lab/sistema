import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Trash2, ArrowRight, Square, Palette, Spline } from 'lucide-react';
import { PDFComment, CommentColor, COMMENT_COLORS, ConnectorType } from '../../types/PDFComment';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import * as PDFCommentsService from '../../services/pdfComments.service';
import logger from '../../utils/logger';
import { useLancamentosForReference, LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';
import LancamentoReferencePicker from '../ui/LancamentoReferencePicker';

const REF_PATTERN = /\[=(\w+):([^:]+):([^\]]+)\]/g;

type ContentSegment =
  | { kind: 'text'; value: string }
  | { kind: 'ref'; refType: string; id: string; label: string };

function parseContent(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let last = 0;
  for (const m of raw.matchAll(REF_PATTERN)) {
    if (m.index! > last) segments.push({ kind: 'text', value: raw.slice(last, m.index) });
    segments.push({ kind: 'ref', refType: m[1], id: m[2], label: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < raw.length) segments.push({ kind: 'text', value: raw.slice(last) });
  return segments;
}

function serializeEditableDiv(div: HTMLDivElement): string {
  let result = '';
  div.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.refId) {
        result += `[=${el.dataset.refType}:${el.dataset.refId}:${el.dataset.refLabel}]`;
      } else if (el.tagName === 'BR') {
        result += '\n';
      } else {
        result += el.textContent;
      }
    }
  });
  return result;
}

function buildEditableHTML(raw: string): string {
  const segments = parseContent(raw);
  return segments.map(seg => {
    if (seg.kind === 'text') {
      return seg.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
    const icon = seg.refType === 'verba' ? '⬡' : seg.refType === 'decisao' ? '◈' : seg.refType === 'tabela' ? '⊞' : '⬜';
    return `<span contenteditable="false" class="lancamento-ref-chip" data-ref="lancamento" data-ref-id="${seg.id}" data-ref-type="${seg.refType}" data-ref-label="${seg.label.replace(/"/g, '&quot;')}" data-type="${seg.refType}" data-id="${seg.id}">${icon} ${seg.label}</span>`;
  }).join('');
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
  const [content, setContent] = useState(comment.content);
  const [showConnectorDropdown, setShowConnectorDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);

  const referenceItems = useLancamentosForReference(processId);

  const balloonRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const connectorDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  const isSelected = state.selectedCommentId === comment.id;

  const posX = comment.positionX * scale;
  const posY = comment.positionY * scale;

  useEffect(() => {
    if (isExpanded && isEditing && editableRef.current) {
      editableRef.current.innerHTML = buildEditableHTML(content);
      editableRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isExpanded, isEditing]);

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
    const serialized = editableRef.current ? serializeEditableDiv(editableRef.current) : content;
    try {
      await PDFCommentsService.updateComment(comment.id, { content: serialized });
      updateComment(comment.id, { content: serialized });
      setContent(serialized);
      setIsEditing(false);
    } catch (error) {
      logger.errorWithException(
        'Falha ao salvar comentário no PDF',
        error as Error,
        'CommentBalloon.handleSave',
        { commentId: comment.id, contentLength: serialized.length }
      );
    }
  };

  const handleCancel = () => {
    if (editableRef.current) editableRef.current.innerHTML = buildEditableHTML(comment.content);
    setContent(comment.content);
    setIsEditing(false);
  };

  const handleEditableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '=' && !e.ctrlKey && !e.metaKey && !e.altKey && referenceItems.length > 0) {
      e.preventDefault();
      const el = editableRef.current;
      if (!el) return;
      setPickerQuery('');
      setPickerAnchor(el.getBoundingClientRect());
      setPickerOpen(true);
    }
  }, [referenceItems.length]);

  const handleReferenceSelect = useCallback((item: LancamentoReferenceItem) => {
    const el = editableRef.current;
    if (!el) return;

    const icon = item.type === 'verba' ? '⬡' : item.type === 'decisao' ? '◈' : item.type === 'tabela' ? '⊞' : '⬜';

    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.className = 'lancamento-ref-chip';
    chip.setAttribute('data-ref', 'lancamento');
    chip.setAttribute('data-type', item.type);
    chip.setAttribute('data-id', item.id);
    chip.dataset.refId = item.id;
    chip.dataset.refType = item.type;
    chip.dataset.refLabel = item.label;
    chip.textContent = `${icon} ${item.label}`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(chip);
    }

    setPickerOpen(false);
    el.focus();
  }, []);

  const handleClose = async () => {
    if (isEditing && content !== comment.content) {
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

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, [contenteditable], input')) return;

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

    const parent = balloonRef.current.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const newX = (e.clientX - parentRect.left - dragOffset.x) / scale;
    const newY = (e.clientY - parentRect.top - dragOffset.y) / scale;

    const clampedX = Math.max(0, Math.min(newX, pageWidth - 24));
    const clampedY = Math.max(0, Math.min(newY, pageHeight - 24));

    latestPositionRef.current = { x: clampedX, y: clampedY };
    updateComment(comment.id, { positionX: clampedX, positionY: clampedY });
  }, [dragOffset, scale, pageWidth, pageHeight, comment.id, updateComment]);

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

  const iconRef = useRef<HTMLDivElement>(null);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (isExpanded && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPopupCoords({ top: rect.bottom + 4, left: rect.left });
    }
  }, [isExpanded]);

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
          className={`fixed w-72 bg-white rounded-lg shadow-xl border ${colorConfig.border} z-[9999]`}
          style={{ top: popupCoords.top, left: popupCoords.left }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={`px-3 py-2 ${colorConfig.bg} flex items-center justify-between rounded-t-lg`}>
            <span className="text-xs text-gray-600">{formattedDate}</span>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white/50 rounded transition-colors"
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>

          <div className="p-3">
            {isEditing ? (
              <div
                ref={editableRef}
                contentEditable
                suppressContentEditableWarning
                onKeyDown={handleEditableKeyDown}
                className="min-h-[60px] max-h-32 overflow-y-auto p-2 text-sm rounded-lg outline-none transition-colors leading-relaxed border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ wordBreak: 'break-word' }}
              />
            ) : content ? (
              <div
                onClick={() => setIsEditing(true)}
                className="min-h-[60px] max-h-32 overflow-y-auto p-2 text-sm rounded-lg transition-colors leading-relaxed cursor-text text-gray-700 bg-gray-50 hover:bg-gray-100"
                style={{ wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: buildEditableHTML(content) }}
              />
            ) : (
              <div
                onClick={() => setIsEditing(true)}
                className="min-h-[60px] p-2 text-sm rounded-lg bg-gray-50 hover:bg-gray-100 cursor-text"
              >
                <span className="text-gray-400 italic">Clique para adicionar comentário...</span>
              </div>
            )}
            {pickerOpen && createPortal(
              <LancamentoReferencePicker
                items={referenceItems}
                query={pickerQuery}
                anchorRect={pickerAnchor}
                onSelect={handleReferenceSelect}
                onClose={() => setPickerOpen(false)}
              />,
              document.body
            )}
          </div>

          {isEditing && (
            <div className="px-3 pb-3 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Salvar
              </button>
            </div>
          )}

          <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-center gap-3">
            <div className="relative" ref={connectorDropdownRef}>
              <button
                onClick={() => setShowConnectorDropdown(!showConnectorDropdown)}
                className={`p-1.5 rounded transition-colors ${showConnectorDropdown ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title="Adicionar conector"
              >
                <Spline size={16} />
              </button>
              {showConnectorDropdown && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-xl border py-1 min-w-[120px] z-[100]">
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
                className={`p-1.5 rounded transition-colors ${showColorDropdown ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title="Mudar cor"
              >
                <Palette size={16} />
              </button>
              {showColorDropdown && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-xl border p-2 z-[100]">
                  <div className="flex gap-1">
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
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Excluir comentário"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(CommentBalloon);
