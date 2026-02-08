import React from 'react';
import { SelectionRect } from '../../hooks/useSelectionOverlay';

interface SelectionOverlayProps {
  pageNumber: number;
  rects: SelectionRect[];
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ pageNumber, rects }) => {
  if (!rects || rects.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
      data-selection-overlay={pageNumber}
    >
      {rects.map((rect, index) => (
        <div
          key={`selection-${pageNumber}-${index}`}
          className="absolute rounded-sm"
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'rgba(0, 120, 215, 0.3)',
            pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
};

export default SelectionOverlay;
