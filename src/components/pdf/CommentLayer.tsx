import React, { useState, useCallback, useMemo } from 'react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { PDFComment, ConnectorType, PDFCommentConnector } from '../../types/PDFComment';
import * as PDFCommentsService from '../../services/pdfComments.service';
import CommentBalloon from './CommentBalloon';
import ArrowConnector from './ArrowConnector';
import HighlightBoxConnector from './HighlightBoxConnector';
import ConnectorDrawer from './ConnectorDrawer';

interface CommentLayerProps {
  pageNumber: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  processDocumentId: string;
}

const CommentLayer: React.FC<CommentLayerProps> = ({
  pageNumber,
  scale,
  pageWidth,
  pageHeight,
  processDocumentId
}) => {
  const {
    state,
    getCommentsByPage,
    addComment,
    addConnectorToComment,
    setDrawingConnector,
    setEditingConnectorId,
    setCommentModeActive
  } = usePDFViewer();

  const [drawingState, setDrawingState] = useState<{
    isDrawing: boolean;
    commentId: string;
    connectorType: ConnectorType;
    startX: number;
    startY: number;
  } | null>(null);

  const comments = getCommentsByPage(pageNumber);

  const { arrowConnectorEntries, highlightBoxEntries } = useMemo(() => {
    const arrows: Array<{ comment: PDFComment; connector: PDFCommentConnector }> = [];
    const boxes: Array<{ comment: PDFComment; connector: PDFCommentConnector }> = [];

    for (const comment of comments) {
      if (!comment.connectors || comment.connectors.length === 0) continue;
      for (const connector of comment.connectors) {
        if (connector.connectorType === 'arrow') {
          arrows.push({ comment, connector });
        } else if (connector.connectorType === 'highlightbox') {
          boxes.push({ comment, connector });
        }
      }
    }

    return { arrowConnectorEntries: arrows, highlightBoxEntries: boxes };
  }, [comments]);

  const handleLayerClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.isCommentModeActive) return;
    if (state.isDrawingConnector) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-comment-balloon]') || target.closest('[data-connector]')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    try {
      const newComment = await PDFCommentsService.createComment({
        processDocumentId,
        pageNumber,
        positionX: x,
        positionY: y,
        color: state.selectedCommentColor
      });

      addComment({ ...newComment, connectors: [] });
      setCommentModeActive(false);
    } catch (error) {
      console.error('Erro ao criar comentário:', error);
    }
  }, [state.isCommentModeActive, state.isDrawingConnector, state.selectedCommentColor, scale, processDocumentId, pageNumber, addComment, setCommentModeActive]);

  const handleStartDrawConnector = useCallback((commentId: string, type: ConnectorType) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    setDrawingConnector(true, type);
    setDrawingState({
      isDrawing: true,
      commentId,
      connectorType: type,
      startX: comment.positionX + 12,
      startY: comment.positionY + 12
    });
  }, [comments, setDrawingConnector]);

  const handleConnectorComplete = useCallback((connector: PDFCommentConnector) => {
    if (drawingState) {
      addConnectorToComment(drawingState.commentId, connector);
    }
    setDrawingState(null);
    setDrawingConnector(false, null);
  }, [drawingState, addConnectorToComment, setDrawingConnector]);

  const handleConnectorCancel = useCallback(() => {
    setDrawingState(null);
    setDrawingConnector(false, null);
  }, [setDrawingConnector]);

  const handleSelectConnector = useCallback((connectorId: string) => {
    setEditingConnectorId(state.editingConnectorId === connectorId ? null : connectorId);
  }, [state.editingConnectorId, setEditingConnectorId]);

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: state.isCommentModeActive ? 'auto' : 'none',
        cursor: state.isCommentModeActive && !state.isDrawingConnector ? 'crosshair' : 'default'
      }}
      onClick={handleLayerClick}
    >
      {arrowConnectorEntries.length > 0 && (
        <svg
          className="absolute inset-0"
          style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
          {arrowConnectorEntries.map(({ comment, connector }) => (
            <g key={connector.id} style={{ pointerEvents: 'auto' }}>
              <ArrowConnector
                connector={connector}
                commentId={comment.id}
                commentX={comment.positionX}
                commentY={comment.positionY}
                scale={scale}
                isEditing={state.editingConnectorId === connector.id}
                onSelect={() => handleSelectConnector(connector.id)}
              />
            </g>
          ))}
        </svg>
      )}

      {highlightBoxEntries.map(({ comment, connector }) => (
        <div key={connector.id} style={{ pointerEvents: 'auto' }}>
          <HighlightBoxConnector
            connector={connector}
            commentId={comment.id}
            commentColor={comment.color}
            commentX={comment.positionX}
            commentY={comment.positionY}
            scale={scale}
            isEditing={state.editingConnectorId === connector.id}
            onSelect={() => handleSelectConnector(connector.id)}
          />
        </div>
      ))}

      {comments.map(comment => (
        <div key={comment.id} data-comment-balloon style={{ pointerEvents: 'auto' }}>
          <CommentBalloon
            comment={comment}
            scale={scale}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            onStartDrawConnector={handleStartDrawConnector}
          />
        </div>
      ))}

      {drawingState && drawingState.isDrawing && (
        <ConnectorDrawer
          commentId={drawingState.commentId}
          connectorType={drawingState.connectorType}
          startX={drawingState.startX}
          startY={drawingState.startY}
          scale={scale}
          onComplete={handleConnectorComplete}
          onCancel={handleConnectorCancel}
        />
      )}
    </div>
  );
};

export default React.memo(CommentLayer);
