import React from 'react';
import HighlightLayer from './HighlightLayer';
import CommentLayer from './CommentLayer';
import PDFSearchHighlightLayer from './PDFSearchHighlightLayer';
import SelectionOverlay from './SelectionOverlay';

interface PDFSelectionCommentLayersProps {
  pageNumber: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  processDocumentId: string;
  processId?: string;
  localPageNumber: number;
  searchResults: unknown[];
  currentSearchIndex: number;
  searchQuery: string;
  selectionRects: Array<{ x: number; y: number; width: number; height: number }>;
  caretRect?: { x: number; y: number; width: number; height: number } | null;
  pageRotation?: number;
}

const PDFSelectionCommentLayers: React.FC<PDFSelectionCommentLayersProps> = ({
  pageNumber,
  scale,
  pageWidth,
  pageHeight,
  processDocumentId,
  processId,
  localPageNumber,
  searchResults,
  currentSearchIndex,
  searchQuery,
  selectionRects,
  caretRect,
  pageRotation = 0,
}) => (
  <>
    <HighlightLayer pageNumber={pageNumber} scale={scale} />
    <CommentLayer
      pageNumber={pageNumber}
      scale={scale}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      processDocumentId={processDocumentId}
      processId={processId}
    />
    <PDFSearchHighlightLayer
      pageNumber={pageNumber}
      scale={scale}
      documentId={processDocumentId}
      localPageNumber={localPageNumber}
      searchResults={searchResults as never[]}
      currentSearchIndex={currentSearchIndex}
      searchQuery={searchQuery}
      pageRotation={pageRotation}
    />
    <SelectionOverlay pageNumber={pageNumber} rects={selectionRects} caretRect={caretRect} />
  </>
);

export default React.memo(PDFSelectionCommentLayers);
