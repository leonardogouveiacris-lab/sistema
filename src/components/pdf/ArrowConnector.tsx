import React, { useState, useCallback } from 'react';
import { PDFCommentConnector } from '../../types/PDFComment';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import * as PDFCommentsService from '../../services/pdfComments.service';

interface ArrowConnectorProps {
  connector: PDFCommentConnector;
  commentId: string;
  commentX: number;
  commentY: number;
  scale: number;
  isEditing: boolean;
  onSelect: () => void;
}

const ArrowConnector: React.FC<ArrowConnectorProps> = ({
  connector,
  commentId,
  commentX,
  commentY,
  scale,
  isEditing,
  onSelect
}) => {
  const { updateConnectorInComment, removeConnectorFromComment } = usePDFViewer();
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingControl, setIsDraggingControl] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const startX = (commentX + 12) * scale;
  const startY = (commentY + 12) * scale;
  const endX = connector.endX * scale;
  const endY = connector.endY * scale;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const controlX = connector.controlX !== undefined ? connector.controlX * scale : midX;
  const controlY = connector.controlY !== undefined ? connector.controlY * scale : midY - 30;

  const angle = Math.atan2(endY - controlY, endX - controlX);
  const arrowLength = 12;
  const arrowAngle = Math.PI / 6;

  const arrowPoint1X = endX - arrowLength * Math.cos(angle - arrowAngle);
  const arrowPoint1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
  const arrowPoint2X = endX - arrowLength * Math.cos(angle + arrowAngle);
  const arrowPoint2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

  const handleEndDragStart = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.stopPropagation();
    setIsDraggingEnd(true);
  };

  const handleControlDragStart = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.stopPropagation();
    setIsDraggingControl(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingEnd && !isDraggingControl) return;

    const svg = document.querySelector(`[data-connector-id="${connector.id}"]`)?.closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const newX = (e.clientX - rect.left) / scale;
    const newY = (e.clientY - rect.top) / scale;

    if (isDraggingEnd) {
      updateConnectorInComment(commentId, connector.id, {
        endX: newX,
        endY: newY
      });
    } else if (isDraggingControl) {
      updateConnectorInComment(commentId, connector.id, {
        controlX: newX,
        controlY: newY
      });
    }
  }, [isDraggingEnd, isDraggingControl, connector.id, commentId, scale, updateConnectorInComment]);

  const handleMouseUp = useCallback(async () => {
    if (isDraggingEnd || isDraggingControl) {
      setIsDraggingEnd(false);
      setIsDraggingControl(false);

      try {
        await PDFCommentsService.updateConnector(connector.id, {
          endX: connector.endX,
          endY: connector.endY,
          controlX: connector.controlX,
          controlY: connector.controlY
        });
      } catch (error) {
        console.error('Erro ao salvar conector:', error);
      }
    }
  }, [isDraggingEnd, isDraggingControl, connector]);

  React.useEffect(() => {
    if (isDraggingEnd || isDraggingControl) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingEnd, isDraggingControl, handleMouseMove, handleMouseUp]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await PDFCommentsService.deleteConnector(connector.id);
      removeConnectorFromComment(commentId, connector.id);
    } catch (error) {
      console.error('Erro ao excluir conector:', error);
    }
  };

  const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

  return (
    <g
      data-connector-id={connector.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="cursor-pointer"
    >
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      <path
        d={pathD}
        fill="none"
        stroke={connector.strokeColor}
        strokeWidth={connector.strokeWidth}
        strokeLinecap="round"
        className={`transition-opacity ${isHovered || isEditing ? 'opacity-100' : 'opacity-80'}`}
      />

      <polygon
        points={`${endX},${endY} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
        fill={connector.strokeColor}
        className={`transition-opacity ${isHovered || isEditing ? 'opacity-100' : 'opacity-80'}`}
      />

      {isEditing && (
        <>
          <line
            x1={startX}
            y1={startY}
            x2={controlX}
            y2={controlY}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
          />
          <line
            x1={controlX}
            y1={controlY}
            x2={endX}
            y2={endY}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
          />

          <circle
            cx={controlX}
            cy={controlY}
            r={8}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={2}
            className="cursor-move"
            onMouseDown={handleControlDragStart}
          />

          <circle
            cx={endX}
            cy={endY}
            r={8}
            fill="#ef4444"
            stroke="white"
            strokeWidth={2}
            className="cursor-move"
            onMouseDown={handleEndDragStart}
          />

          <g
            onClick={handleDelete}
            className="cursor-pointer"
            transform={`translate(${controlX + 15}, ${controlY - 15})`}
          >
            <circle r={10} fill="white" stroke="#ef4444" strokeWidth={2} />
            <line x1={-4} y1={-4} x2={4} y2={4} stroke="#ef4444" strokeWidth={2} />
            <line x1={4} y1={-4} x2={-4} y2={4} stroke="#ef4444" strokeWidth={2} />
          </g>
        </>
      )}

      {isHovered && !isEditing && (
        <circle
          cx={controlX}
          cy={controlY}
          r={4}
          fill="#3b82f6"
          opacity={0.5}
        />
      )}
    </g>
  );
};

export default React.memo(ArrowConnector);
