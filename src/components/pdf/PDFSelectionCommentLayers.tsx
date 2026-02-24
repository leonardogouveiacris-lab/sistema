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
  localPageNumber: number;
  searchResults: unknown[];
  currentSearchIndex: number;
  searchQuery: string;
  selectionRects: Array<{ x: number; y: number; width: number; height: number }>;
}

const PDFSelectionCommentLayers: React.FC<PDFSelectionCommentLayersProps> = ({
  pageNumber,
  scale,
  pageWidth,
  pageHeight,
  processDocumentId,
  localPageNumber,
  searchResults,
  currentSearchIndex,
  searchQuery,
  selectionRects,
}) => (
  <>
    <HighlightLayer pageNumber={pageNumber} scale={scale} />
    <CommentLayer
      pageNumber={pageNumber}
      scale={scale}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      processDocumentId={processDocumentId}
    />
    <PDFSearchHighlightLayer
      pageNumber={pageNumber}
      scale={scale}
      documentId={processDocumentId}
      localPageNumber={localPageNumber}
      searchResults={searchResults as never[]}
      currentSearchIndex={currentSearchIndex}
      searchQuery={searchQuery}
    />
    <SelectionOverlay pageNumber={pageNumber} rects={selectionRects} />
  </>
);

export default React.memo(PDFSelectionCommentLayers);
