import React, { memo, useMemo } from 'react';
import { SelectionRect } from '../../hooks/useSelectionOverlay';

interface SelectionOverlayProps {
  pageNumber: number;
  rects: SelectionRect[];
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = memo(({ pageNumber, rects }) => {
  const stableRects = useMemo(() => {
    if (!rects || rects.length === 0) return [];
    return rects.map((rect, index) => ({
      ...rect,
      key: `sel-${pageNumber}-${Math.round(rect.x)}-${Math.round(rect.y)}-${index}`
    }));
  }, [rects, pageNumber]);

  if (stableRects.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
      data-selection-overlay={pageNumber}
    >
      {stableRects.map((rect) => (
        <div
          key={rect.key}
          className="absolute rounded-sm"
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'rgba(0, 120, 215, 0.3)',
            pointerEvents: 'none',
            transition: 'opacity 50ms ease-out',
            willChange: 'opacity'
          }}
        />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.pageNumber !== nextProps.pageNumber) return false;
  if (prevProps.rects === nextProps.rects) return true;
  if (!prevProps.rects || !nextProps.rects) return prevProps.rects === nextProps.rects;
  if (prevProps.rects.length !== nextProps.rects.length) return false;

  for (let i = 0; i < prevProps.rects.length; i++) {
    const a = prevProps.rects[i];
    const b = nextProps.rects[i];
    if (
      Math.abs(a.x - b.x) > 0.5 ||
      Math.abs(a.y - b.y) > 0.5 ||
      Math.abs(a.width - b.width) > 0.5 ||
      Math.abs(a.height - b.height) > 0.5
    ) {
      return false;
    }
  }
  return true;
});

SelectionOverlay.displayName = 'SelectionOverlay';

export default SelectionOverlay;
