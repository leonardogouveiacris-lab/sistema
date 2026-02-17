import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Trash2, Palette } from 'lucide-react';
import { PDFHighlight, HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_CONFIG, HighlightColor } from '../../types/Highlight';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { useToast } from '../../contexts/ToastContext';
import * as HighlightsService from '../../services/highlights.service';
import logger from '../../utils/logger';

interface HighlightLayerProps {
  pageNumber: number;
  scale: number;
}

interface ContextMenuState {
  highlightId: string;
  x: number;
  y: number;
}

interface ComputedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ComputedHighlight {
  id: string;
  color: string;
  colorConfig: typeof HIGHLIGHT_COLOR_CONFIG[keyof typeof HIGHLIGHT_COLOR_CONFIG];
  rects: ComputedRect[];
}

function computeHighlightRects(highlight: PDFHighlight): ComputedRect[] {
  const { positionData } = highlight;

  if (positionData.rects && positionData.rects.length > 0) {
    return positionData.rects;
  }

  const avgCharWidth = 7;
  const avgLineHeight = 16;
  const totalHeight = positionData.height;
  const totalWidth = positionData.width;
  const numLines = Math.max(1, Math.round(totalHeight / avgLineHeight));

  if (numLines === 1) {
    return [{
      x: positionData.x,
      y: positionData.y,
      width: totalWidth,
      height: totalHeight
    }];
  }

  const rects: ComputedRect[] = [];
  const textLength = highlight.selectedText.length;
  const estimatedCharsPerLine = Math.ceil(textLength / numLines);

  for (let i = 0; i < numLines; i++) {
    const isLastLine = i === numLines - 1;
    const lineY = positionData.y + (i * avgLineHeight);
    const lineHeight = isLastLine
      ? totalHeight - (i * avgLineHeight)
      : avgLineHeight;

    let lineWidth: number;
    if (isLastLine) {
      const remainingChars = textLength - (estimatedCharsPerLine * (numLines - 1));
      lineWidth = Math.min(remainingChars * avgCharWidth, totalWidth * 0.8);
    } else {
      lineWidth = totalWidth;
    }

    rects.push({
      x: positionData.x,
      y: lineY,
      width: lineWidth,
      height: lineHeight
    });
  }

  return rects;
}

const HighlightLayer: React.FC<HighlightLayerProps> = ({ pageNumber, scale }) => {
  const {
    state,
    getHighlightsByPage,
    removeHighlight,
    updateHighlightColor: updateHighlightColorInContext,
    setHoveredHighlightId
  } = usePDFViewer();

  const toast = useToast();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(null);

  const highlights = useMemo(() => getHighlightsByPage(pageNumber), [getHighlightsByPage, pageNumber]);

  const computedHighlights = useMemo<ComputedHighlight[]>(() => {
    return highlights.map(highlight => ({
      id: highlight.id,
      color: highlight.color,
      colorConfig: HIGHLIGHT_COLOR_CONFIG[highlight.color],
      rects: computeHighlightRects(highlight)
    }));
  }, [highlights]);

  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const rect = contextMenuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;

      let x = contextMenu.x;
      let y = contextMenu.y;

      if (x + rect.width > vw - pad) x = vw - rect.width - pad;
      if (y + rect.height > vh - pad) y = vh - rect.height - pad;
      if (x < pad) x = pad;
      if (y < pad) y = pad;

      setAdjustedPos({ x, y });
    } else {
      setAdjustedPos(null);
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, highlightId: string) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      highlightId,
      x: e.clientX,
      y: e.clientY
    });

    logger.info(
      `Context menu opened for highlight ${highlightId}`,
      'HighlightLayer.handleContextMenu'
    );
  }, []);

  const handleColorChange = useCallback(async (highlightId: string, color: HighlightColor) => {
    logger.info(
      `Changing highlight color: ${highlightId} -> ${color}`,
      'HighlightLayer.handleColorChange'
    );

    const success = await HighlightsService.updateHighlightColor(highlightId, color);

    if (success) {
      updateHighlightColorInContext(highlightId, color);
      setContextMenu(null);
    } else {
      toast.error('Erro ao atualizar cor do destaque');
    }
  }, [updateHighlightColorInContext, toast]);

  const handleDelete = useCallback(async (highlightId: string) => {
    setIsDeleting(highlightId);
    setContextMenu(null);

    logger.info(
      `Deleting highlight: ${highlightId}`,
      'HighlightLayer.handleDelete'
    );

    try {
      const success = await HighlightsService.deleteHighlight(highlightId);

      if (success) {
        removeHighlight(highlightId);
        toast.success('Destaque excluido com sucesso');
        logger.success(
          `Highlight deleted from UI: ${highlightId}`,
          'HighlightLayer.handleDelete'
        );
      } else {
        logger.error(
          `Failed to delete highlight: ${highlightId}`,
          'HighlightLayer.handleDelete'
        );
        toast.error('Erro ao excluir destaque.');
      }
    } catch (error) {
      logger.errorWithException(
        `Exception deleting highlight: ${highlightId}`,
        error as Error,
        'HighlightLayer.handleDelete'
      );
      toast.error('Erro ao excluir destaque.');
    } finally {
      setIsDeleting(null);
    }
  }, [removeHighlight, toast]);

  const handleMouseEnter = useCallback((highlightId: string) => {
    setHoveredHighlightId(highlightId);
  }, [setHoveredHighlightId]);

  const handleMouseLeave = useCallback(() => {
    setHoveredHighlightId(null);
  }, [setHoveredHighlightId]);

  if (computedHighlights.length === 0) {
    return null;
  }

  const multiplier = scale;

  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-10">
        {computedHighlights.map(({ id, colorConfig, rects }) => {
          const isHovered = state.hoveredHighlightId === id;
          const isSelected = state.selectedHighlightIds.includes(id);
          const isBeingDeleted = isDeleting === id;

          const selectedClasses = isSelected
            ? 'ring-2 ring-blue-400 ring-opacity-75 shadow-md animate-pulse'
            : '';

          return (
            <React.Fragment key={id}>
              {rects.map((rect, index) => (
                <div
                  key={`${id}-rect-${index}`}
                  id={index === 0 ? `highlight-${id}` : undefined}
                  className={`rounded-sm ${colorConfig.bg} ${colorConfig.opacity} ${colorConfig.border} border ${isBeingDeleted ? 'animate-pulse' : ''} ${selectedClasses}`}
                  style={{
                    position: 'absolute',
                    left: `${rect.x * multiplier}px`,
                    top: `${rect.y * multiplier}px`,
                    width: `${rect.width * multiplier}px`,
                    height: `${rect.height * multiplier}px`,
                    pointerEvents: isBeingDeleted ? 'none' : 'auto',
                    cursor: isBeingDeleted ? 'wait' : 'pointer',
                    transition: 'all 200ms ease-in-out',
                    opacity: isBeingDeleted ? 0.3 : isHovered ? 0.5 : undefined,
                    zIndex: isSelected ? 20 : undefined
                  }}
                  onContextMenu={(e) => handleContextMenu(e, id)}
                  onMouseEnter={() => handleMouseEnter(id)}
                  onMouseLeave={handleMouseLeave}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[10001] bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
          style={{
            left: `${(adjustedPos ?? contextMenu).x}px`,
            top: `${(adjustedPos ?? contextMenu).y}px`,
            visibility: adjustedPos ? 'visible' : 'hidden'
          }}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
              <Palette size={14} />
              <span className="font-medium">Cor do destaque</span>
            </div>
            <div className="flex items-center gap-2">
              {HIGHLIGHT_COLORS.map((color) => {
                const cc = HIGHLIGHT_COLOR_CONFIG[color];
                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(contextMenu.highlightId, color)}
                    className={`w-6 h-6 rounded ${cc.bg} ${cc.border} border-2 hover:scale-110 transition-transform`}
                    title={color}
                  />
                );
              })}
            </div>
          </div>

          <button
            onClick={() => handleDelete(contextMenu.highlightId)}
            disabled={isDeleting !== null}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            <span>Excluir destaque</span>
          </button>
        </div>
      )}
    </>
  );
};

HighlightLayer.displayName = 'HighlightLayer';

export default HighlightLayer;
