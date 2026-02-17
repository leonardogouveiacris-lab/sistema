/**
 * HighlightLayer - Overlay component for rendering text highlights on PDF
 *
 * Features:
 * - Renders colored rectangles over highlighted text
 * - Adjusts position and size based on zoom level
 * - Context menu for changing color or deleting highlight
 * - Supports multiple highlights per page
 *
 * Performance optimizations:
 * - Wrapped with React.memo and custom comparator
 * - Handlers memoized with useCallback
 * - Highlights filtered with useMemo
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
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

const HighlightLayer: React.FC<HighlightLayerProps> = memo(({ pageNumber, scale }) => {
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

  const highlights = useMemo(() => getHighlightsByPage(pageNumber), [getHighlightsByPage, pageNumber]);

  /**
   * Close context menu when clicking outside
   */
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

  /**
   * Handle right-click on highlight to show context menu
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, highlight: PDFHighlight) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      highlightId: highlight.id,
      x: e.clientX,
      y: e.clientY
    });

    logger.info(
      `Context menu opened for highlight ${highlight.id}`,
      'HighlightLayer.handleContextMenu'
    );
  }, []);

  /**
   * Handle color change
   */
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

  /**
   * Handle highlight deletion
   */
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

  const handleMouseEnter = useCallback((highlight: PDFHighlight) => {
    setHoveredHighlightId(highlight.id);
  }, [setHoveredHighlightId]);

  const handleMouseLeave = useCallback(() => {
    setHoveredHighlightId(null);
  }, [setHoveredHighlightId]);

  if (highlights.length === 0) {
    return null;
  }

  return (
    <>
      {/* Render highlights */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {highlights.map((highlight) => {
          const { positionData, color, id } = highlight;
          const colorConfig = HIGHLIGHT_COLOR_CONFIG[color];
          const isHovered = state.hoveredHighlightId === id;
          const isSelected = state.selectedHighlightIds.includes(id);

          const multiplier = scale;

          let rects: Array<{ x: number; y: number; width: number; height: number }>;

          if (positionData.rects && positionData.rects.length > 0) {
            rects = positionData.rects;
          } else {
            const avgCharWidth = 7;
            const avgLineHeight = 16;
            const totalHeight = positionData.height;
            const totalWidth = positionData.width;

            const numLines = Math.max(1, Math.round(totalHeight / avgLineHeight));

            if (numLines === 1) {
              rects = [{
                x: positionData.x,
                y: positionData.y,
                width: totalWidth,
                height: totalHeight
              }];
            } else {
              rects = [];
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
                  lineWidth = Math.min(
                    remainingChars * avgCharWidth,
                    totalWidth * 0.8
                  );
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
            }
          }

          const isBeingDeleted = isDeleting === id;

          return (
            <React.Fragment key={id}>
              {rects.map((rect, index) => {
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: `${rect.x * multiplier}px`,
                  top: `${rect.y * multiplier}px`,
                  width: `${rect.width * multiplier}px`,
                  height: `${rect.height * multiplier}px`,
                  pointerEvents: isBeingDeleted ? 'none' : 'auto',
                  cursor: isBeingDeleted ? 'wait' : 'pointer',
                  transition: 'all 200ms ease-in-out',
                  opacity: isBeingDeleted ? '0.3' : isHovered ? '0.5' : undefined,
                  zIndex: isSelected ? 20 : undefined
                };

                const selectedClasses = isSelected
                  ? 'ring-2 ring-blue-400 ring-opacity-75 shadow-md animate-pulse'
                  : '';

                return (
                  <div
                    key={`${id}-rect-${index}`}
                    id={index === 0 ? `highlight-${id}` : undefined}
                    className={`rounded-sm ${colorConfig.bg} ${colorConfig.opacity} ${colorConfig.border} border ${isBeingDeleted ? 'animate-pulse' : ''} ${selectedClasses}`}
                    style={style}
                    onContextMenu={(e) => handleContextMenu(e, highlight)}
                    onMouseEnter={() => handleMouseEnter(highlight)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[10001] bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
        >
          {/* Color options */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
              <Palette size={14} />
              <span className="font-medium">Cor do destaque</span>
            </div>
            <div className="flex items-center gap-2">
              {HIGHLIGHT_COLORS.map((color) => {
                const colorConfig = HIGHLIGHT_COLOR_CONFIG[color];
                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(contextMenu.highlightId, color)}
                    className={`w-6 h-6 rounded ${colorConfig.bg} ${colorConfig.border} border-2 hover:scale-110 transition-transform`}
                    title={color}
                  />
                );
              })}
            </div>
          </div>

          {/* Delete option */}
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
}, (prevProps, nextProps) => {
  return prevProps.pageNumber === nextProps.pageNumber && prevProps.scale === nextProps.scale;
});

HighlightLayer.displayName = 'HighlightLayer';

export default HighlightLayer;
