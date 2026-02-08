import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { PDFCommentConnector, COMMENT_COLOR_VALUES, CommentColor } from '../../types/PDFComment';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import * as PDFCommentsService from '../../services/pdfComments.service';

interface HighlightBoxConnectorProps {
  connector: PDFCommentConnector;
  commentId: string;
  commentColor: CommentColor;
  commentX: number;
  commentY: number;
  scale: number;
  isEditing: boolean;
  onSelect: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

const HighlightBoxConnector: React.FC<HighlightBoxConnectorProps> = ({
  connector,
  commentId,
  commentColor,
  commentX,
  commentY,
  scale,
  isEditing,
  onSelect
}) => {
  const { updateConnectorInComment, removeConnectorFromComment } = usePDFViewer();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialBox, setInitialBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [initialMouse, setInitialMouse] = useState({ x: 0, y: 0 });

  const boxRef = useRef<HTMLDivElement>(null);

  const boxX = connector.endX * scale;
  const boxY = connector.endY * scale;
  const boxWidth = (connector.boxWidth || 120) * scale;
  const boxHeight = (connector.boxHeight || 60) * scale;

  const startX = (commentX + 12) * scale;
  const startY = (commentY + 12) * scale;

  const boxColor = COMMENT_COLOR_VALUES[commentColor] || COMMENT_COLOR_VALUES.yellow;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await PDFCommentsService.deleteConnector(connector.id);
      removeConnectorFromComment(commentId, connector.id);
    } catch (error) {
      console.error('Erro ao excluir conector:', error);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (!isEditing || isResizing) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);
    setInitialBox({
      x: connector.endX,
      y: connector.endY,
      w: connector.boxWidth || 120,
      h: connector.boxHeight || 60
    });
    setInitialMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && boxRef.current) {
      const parent = boxRef.current.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const newX = (e.clientX - parentRect.left - dragOffset.x) / scale;
      const newY = (e.clientY - parentRect.top - dragOffset.y) / scale;

      updateConnectorInComment(commentId, connector.id, {
        endX: newX,
        endY: newY
      });
    }

    if (isResizing && resizeHandle) {
      const deltaX = (e.clientX - initialMouse.x) / scale;
      const deltaY = (e.clientY - initialMouse.y) / scale;

      let newX = initialBox.x;
      let newY = initialBox.y;
      let newW = initialBox.w;
      let newH = initialBox.h;

      const minSize = 10;

      switch (resizeHandle) {
        case 'se':
          newW = Math.max(minSize, initialBox.w + deltaX);
          newH = Math.max(minSize, initialBox.h + deltaY);
          break;
        case 'sw':
          newW = Math.max(minSize, initialBox.w - deltaX);
          newH = Math.max(minSize, initialBox.h + deltaY);
          newX = initialBox.x + (initialBox.w - newW);
          break;
        case 'ne':
          newW = Math.max(minSize, initialBox.w + deltaX);
          newH = Math.max(minSize, initialBox.h - deltaY);
          newY = initialBox.y + (initialBox.h - newH);
          break;
        case 'nw':
          newW = Math.max(minSize, initialBox.w - deltaX);
          newH = Math.max(minSize, initialBox.h - deltaY);
          newX = initialBox.x + (initialBox.w - newW);
          newY = initialBox.y + (initialBox.h - newH);
          break;
        case 'e':
          newW = Math.max(minSize, initialBox.w + deltaX);
          break;
        case 'w':
          newW = Math.max(minSize, initialBox.w - deltaX);
          newX = initialBox.x + (initialBox.w - newW);
          break;
        case 's':
          newH = Math.max(minSize, initialBox.h + deltaY);
          break;
        case 'n':
          newH = Math.max(minSize, initialBox.h - deltaY);
          newY = initialBox.y + (initialBox.h - newH);
          break;
      }

      updateConnectorInComment(commentId, connector.id, {
        endX: newX,
        endY: newY,
        boxWidth: newW,
        boxHeight: newH
      });
    }
  }, [isDragging, isResizing, resizeHandle, dragOffset, scale, commentId, connector.id, initialBox, initialMouse, updateConnectorInComment]);

  const handleMouseUp = useCallback(async () => {
    if (isDragging) {
      setIsDragging(false);
      try {
        await PDFCommentsService.updateConnector(connector.id, {
          endX: connector.endX,
          endY: connector.endY
        });
      } catch (error) {
        console.error('Erro ao salvar posição:', error);
      }
    }

    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      try {
        await PDFCommentsService.updateConnector(connector.id, {
          endX: connector.endX,
          endY: connector.endY,
          boxWidth: connector.boxWidth,
          boxHeight: connector.boxHeight
        });
      } catch (error) {
        console.error('Erro ao salvar dimensões:', error);
      }
    }
  }, [isDragging, isResizing, connector]);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const controlX = connector.controlX !== undefined ? connector.controlX * scale : (startX + boxX + boxWidth / 2) / 2;
  const controlY = connector.controlY !== undefined ? connector.controlY * scale : Math.min(startY, boxY) - 20;

  const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${boxX + boxWidth / 2} ${boxY}`;

  const resizeHandles: { handle: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    { handle: 'nw', style: { top: -4, left: -4 }, cursor: 'nwse-resize' },
    { handle: 'ne', style: { top: -4, right: -4 }, cursor: 'nesw-resize' },
    { handle: 'sw', style: { bottom: -4, left: -4 }, cursor: 'nesw-resize' },
    { handle: 'se', style: { bottom: -4, right: -4 }, cursor: 'nwse-resize' },
    { handle: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'e', style: { right: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { handle: 'w', style: { left: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' }
  ];

  return (
    <>
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <path
          d={pathD}
          fill="none"
          stroke={connector.strokeColor}
          strokeWidth={connector.strokeWidth}
          strokeLinecap="round"
          strokeDasharray="6 3"
        />
      </svg>

      <div
        ref={boxRef}
        className={`absolute rounded transition-shadow ${
          isEditing ? 'shadow-lg' : ''
        }`}
        style={{
          left: boxX,
          top: boxY,
          width: boxWidth,
          height: boxHeight,
          backgroundColor: boxColor,
          opacity: 0.4,
          border: `2px ${isEditing ? 'solid' : 'dashed'} ${connector.strokeColor}`,
          cursor: isEditing && !isResizing ? 'move' : 'default'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onMouseDown={handleDragStart}
      >
        {isEditing && (
          <>
            <button
              onClick={handleDelete}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
            >
              <X size={12} />
            </button>

            {resizeHandles.map(({ handle, style, cursor }) => (
              <div
                key={handle}
                className="absolute w-2 h-2 bg-white border-2 border-blue-500 rounded-sm"
                style={{ ...style, cursor }}
                onMouseDown={(e) => handleResizeStart(e, handle)}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};

export default React.memo(HighlightBoxConnector);
