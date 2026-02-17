import React, { memo, useMemo } from 'react';
import { Page } from 'react-pdf';

const CAPPED_DPR = Math.min(window.devicePixelRatio || 1, 1.5);

interface MemoizedPDFPageProps {
  pageNumber: number;
  scale: number;
  displayScale?: number;
  userRotation?: number;
  internalRotation?: number;
  onLoadSuccess?: (page: any) => void;
  loading?: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
  renderTextLayer?: boolean;
  renderAnnotationLayer?: boolean;
  isInteracting?: boolean;
  children?: React.ReactNode;
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
  wrapperClassName,
  renderTextLayer = true,
  renderAnnotationLayer = true,
  isInteracting = false,
  children
}) => {
  const effectiveDisplayScale = displayScale ?? scale;
  const cssScaleRatio = effectiveDisplayScale / scale;
  const needsCssTransform = Math.abs(cssScaleRatio - 1) > 0.001;

  const wrapperStyle = useMemo(() => {
    return {
      transform: needsCssTransform ? `scale(${cssScaleRatio})` : undefined,
      transformOrigin: 'top left',
      willChange: isInteracting ? 'transform' : 'auto',
      contain: 'layout paint',
    } as React.CSSProperties;
  }, [cssScaleRatio, needsCssTransform, isInteracting]);

  const effectiveRenderTextLayer = isInteracting ? false : renderTextLayer;
  const effectiveRenderAnnotationLayer = isInteracting ? false : renderAnnotationLayer;

  const hasUserRotation = userRotation !== 0;
  const combinedRotation = hasUserRotation ? ((internalRotation + userRotation) % 360 + 360) % 360 : undefined;

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      <Page
        pageNumber={pageNumber}
        scale={scale}
        devicePixelRatio={CAPPED_DPR}
        canvasBackground="white"
        {...(combinedRotation !== undefined ? { rotate: combinedRotation } : {})}
        onLoadSuccess={onLoadSuccess}
        loading={loading}
        className={className}
        renderTextLayer={effectiveRenderTextLayer}
        renderAnnotationLayer={effectiveRenderAnnotationLayer}
      />
      {children}
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
  if (prevProps.wrapperClassName !== nextProps.wrapperClassName) return false;
  return true;
});

MemoizedPDFPage.displayName = 'MemoizedPDFPage';

export default MemoizedPDFPage;
