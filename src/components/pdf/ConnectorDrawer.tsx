import React, { useState, useCallback, useEffect } from 'react';
import { usePDFViewer } from '../../contexts/PDFViewerContext';
import { ConnectorType, PDFCommentConnector } from '../../types/PDFComment';
import * as PDFCommentsService from '../../services/pdfComments.service';

interface ConnectorDrawerProps {
  commentId: string;
  connectorType: ConnectorType;
  startX: number;
  startY: number;
  scale: number;
  onComplete: (connector: PDFCommentConnector) => void;
  onCancel: () => void;
}

const ConnectorDrawer: React.FC<ConnectorDrawerProps> = ({
  commentId,
  connectorType,
  startX,
  startY,
  scale,
  onComplete,
  onCancel
}) => {
  const { setDrawingConnector } = usePDFViewer();
  const [currentPos, setCurrentPos] = useState({ x: startX, y: startY });
  const [isDrawing, setIsDrawing] = useState(true);

  const scaledStartX = startX * scale;
  const scaledStartY = startY * scale;
  const scaledCurrentX = currentPos.x * scale;
  const scaledCurrentY = currentPos.y * scale;

  const midX = (scaledStartX + scaledCurrentX) / 2;
  const midY = Math.min(scaledStartY, scaledCurrentY) - 30;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDrawing) return;

    const svg = document.getElementById('connector-drawer-svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setCurrentPos({ x, y });
  }, [isDrawing, scale]);

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!isDrawing) return;

    const svg = document.getElementById('connector-drawer-svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const endX = (e.clientX - rect.left) / scale;
    const endY = (e.clientY - rect.top) / scale;

    const distance = Math.sqrt(
      Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
    );

    if (distance < 20) {
      onCancel();
      return;
    }

    try {
      const controlX = (startX + endX) / 2;
      const controlY = Math.min(startY, endY) - 30 / scale;

      const connector = await PDFCommentsService.createConnector({
        commentId,
        connectorType,
        startX,
        startY,
        endX,
        endY,
        controlX,
        controlY,
        boxWidth: connectorType === 'highlightbox' ? 80 : undefined,
        boxHeight: connectorType === 'highlightbox' ? 20 : undefined
      });

      onComplete(connector);
    } catch (error) {
      console.error('Erro ao criar conector:', error);
      onCancel();
    }

    setIsDrawing(false);
    setDrawingConnector(false, null);
  }, [isDrawing, scale, startX, startY, commentId, connectorType, onComplete, onCancel, setDrawingConnector]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDrawing(false);
      setDrawingConnector(false, null);
      onCancel();
    }
  }, [onCancel, setDrawingConnector]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMouseMove, handleMouseUp, handleKeyDown]);

  const renderArrowPreview = () => {
    const angle = Math.atan2(scaledCurrentY - midY, scaledCurrentX - midX);
    const arrowLength = 12;
    const arrowAngle = Math.PI / 6;

    const arrowPoint1X = scaledCurrentX - arrowLength * Math.cos(angle - arrowAngle);
    const arrowPoint1Y = scaledCurrentY - arrowLength * Math.sin(angle - arrowAngle);
    const arrowPoint2X = scaledCurrentX - arrowLength * Math.cos(angle + arrowAngle);
    const arrowPoint2Y = scaledCurrentY - arrowLength * Math.sin(angle + arrowAngle);

    return (
      <>
        <path
          d={`M ${scaledStartX} ${scaledStartY} Q ${midX} ${midY} ${scaledCurrentX} ${scaledCurrentY}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
        <polygon
          points={`${scaledCurrentX},${scaledCurrentY} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
          fill="#3b82f6"
        />
      </>
    );
  };

  const renderHighlightBoxPreview = () => {
    const boxWidth = 80;
    const boxHeight = 20;

    return (
      <>
        <path
          d={`M ${scaledStartX} ${scaledStartY} Q ${midX} ${midY} ${scaledCurrentX + boxWidth / 2} ${scaledCurrentY}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
        <rect
          x={scaledCurrentX}
          y={scaledCurrentY}
          width={boxWidth}
          height={boxHeight}
          fill="#fef08a"
          fillOpacity={0.4}
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
          rx={4}
        />
      </>
    );
  };

  return (
    <svg
      id="connector-drawer-svg"
      className="absolute inset-0 z-50"
      style={{
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        overflow: 'visible'
      }}
    >
      <circle
        cx={scaledStartX}
        cy={scaledStartY}
        r={6}
        fill="#3b82f6"
        stroke="white"
        strokeWidth={2}
      />

      {connectorType === 'arrow' && renderArrowPreview()}
      {connectorType === 'highlightbox' && renderHighlightBoxPreview()}

      <circle
        cx={scaledCurrentX}
        cy={scaledCurrentY}
        r={4}
        fill="#ef4444"
        stroke="white"
        strokeWidth={2}
      />
    </svg>
  );
};

export default ConnectorDrawer;
