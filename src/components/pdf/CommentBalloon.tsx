import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Trash2, ArrowRight, Square, Palette, Spline } from 'lucide-react';
import { PDFComment, CommentColor, COMMENT_COLORS, ConnectorType } from '../../types/PDFComment';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import * as PDFCommentsService from '../../services/pdfComments.service';

interface CommentBalloonProps {
  comment: PDFComment;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  onStartDrawConnector: (commentId: string, type: ConnectorType) => void;
}

const COLOR_OPTIONS: CommentColor[] = ['yellow', 'green', 'blue', 'pink', 'orange', 'red'];

const CommentBalloon: React.FC<CommentBalloonProps> = ({
  comment,
  scale,
  pageWidth,
  pageHeight,
  onStartDrawConnector
}) => {
  const { updateComment, removeComment, selectComment, state } = usePDFViewer();
  const [isExpanded, setIsExpanded] = useState(!comment.isMinimized);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [showConnectorDropdown, setShowConnectorDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const balloonRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const connectorDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  const isSelected = state.selectedCommentId === comment.id;

  const posX = comment.positionX * scale;
  const posY = comment.positionY * scale;

  useEffect(() => {
    if (isExpanded && isEditing && textareaRef.current) {
      textareaRef.current.focus();
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
    try {
      await PDFCommentsService.updateComment(comment.id, { content });
      updateComment(comment.id, { content });
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar comentário:', error);
    }
  };

  const handleCancel = () => {
    setContent(comment.content);
    setIsEditing(false);
  };

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
      console.error('Erro ao minimizar comentário:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await PDFCommentsService.deleteComment(comment.id);
      removeComment(comment.id);
    } catch (error) {
      console.error('Erro ao excluir comentário:', error);
    }
  };

  const handleColorChange = async (color: CommentColor) => {
    try {
      await PDFCommentsService.updateComment(comment.id, { color });
      updateComment(comment.id, { color });
      setShowColorDropdown(false);
    } catch (error) {
      console.error('Erro ao mudar cor:', error);
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
    if ((e.target as HTMLElement).closest('button, textarea, input')) return;

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
      console.error('Erro ao salvar posição:', error);
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
        onClick={handleIconClick}
        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md hover:shadow-lg ${colorConfig.bg} ${colorConfig.border} border-2 ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
        }`}
      >
        <MessageCircle size={16} className={colorConfig.icon} />
      </div>

      {isExpanded && (
        <div
          className={`absolute top-10 left-0 w-72 bg-white rounded-lg shadow-xl border ${colorConfig.border} z-40`}
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
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite seu comentário..."
                className="w-full h-24 p-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div
                onClick={() => setIsEditing(true)}
                className="min-h-[60px] p-2 text-sm text-gray-700 bg-gray-50 rounded-lg cursor-text hover:bg-gray-100 transition-colors"
              >
                {comment.content || (
                  <span className="text-gray-400 italic">Clique para adicionar comentário...</span>
                )}
              </div>
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
        </div>
      )}
    </div>
  );
};

export default React.memo(CommentBalloon);
