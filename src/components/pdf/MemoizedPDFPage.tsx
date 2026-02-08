import React, { memo, useMemo } from 'react';
import { Page } from 'react-pdf';

interface MemoizedPDFPageProps {
  pageNumber: number;
  scale: number;
  displayScale?: number;
  userRotation?: number;
  internalRotation?: number;
  onLoadSuccess?: (page: any) => void;
  loading?: React.ReactNode;
  className?: string;
  renderTextLayer?: boolean;
  renderAnnotationLayer?: boolean;
  isInteracting?: boolean;
}

const MemoizedPDFPage: React.FC<MemoizedPDFPageProps> = memo(({
  pageNumber,
  scale,
  displayScale,
  userRotation = 0,
  internalRotation = 0,
  onLoadSuccess,
  loading,
  className,
  renderTextLayer = true,
  renderAnnotationLayer = true,
  isInteracting = false
}) => {
  const effectiveDisplayScale = displayScale ?? scale;
  const cssScaleRatio = effectiveDisplayScale / scale;
  const needsCssTransform = Math.abs(cssScaleRatio - 1) > 0.001;

  const wrapperStyle = useMemo(() => {
    return {
      transform: needsCssTransform ? `scale(${cssScaleRatio})` : undefined,
      transformOrigin: 'top left',
      willChange: isInteracting ? 'transform' : 'auto'
    } as React.CSSProperties;
  }, [cssScaleRatio, needsCssTransform, isInteracting]);

  const effectiveRenderTextLayer = isInteracting ? false : renderTextLayer;
  const effectiveRenderAnnotationLayer = isInteracting ? false : renderAnnotationLayer;

  const hasUserRotation = userRotation !== 0;
  const combinedRotation = hasUserRotation ? ((internalRotation + userRotation) % 360 + 360) % 360 : undefined;

  return (
    <div style={wrapperStyle}>
      <Page
        pageNumber={pageNumber}
        scale={scale}
        {...(combinedRotation !== undefined ? { rotate: combinedRotation } : {})}
        onLoadSuccess={onLoadSuccess}
        loading={loading}
        className={className}
        renderTextLayer={effectiveRenderTextLayer}
        renderAnnotationLayer={effectiveRenderAnnotationLayer}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.pageNumber !== nextProps.pageNumber) return false;
  if (prevProps.scale !== nextProps.scale) return false;
  if (prevProps.displayScale !== nextProps.displayScale) return false;
  if (prevProps.userRotation !== nextProps.userRotation) return false;
  if (prevProps.internalRotation !== nextProps.internalRotation) return false;
  if (prevProps.renderTextLayer !== nextProps.renderTextLayer) return false;
  if (prevProps.renderAnnotationLayer !== nextProps.renderAnnotationLayer) return false;
  if (prevProps.isInteracting !== nextProps.isInteracting) return false;
  return true;
});

MemoizedPDFPage.displayName = 'MemoizedPDFPage';

export default MemoizedPDFPage;
