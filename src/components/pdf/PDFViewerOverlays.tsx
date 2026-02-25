import React from 'react';
import TextSelectionPopup from './TextSelectionPopup';
import PageRangeRotationModal from './PageRangeRotationModal';
import PageExtractionModal from './PageExtractionModal';

interface PDFViewerOverlaysProps {
  selectedText: string;
  selectionPosition: any;
  onCopy: () => void;
  onHighlight: () => void;
  onInsertFundamentacao: () => void;
  onInsertComentarios: () => void;
  onCloseSelection: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  formMode: string;
  totalPages: number;
  isPageExtractionModalOpen: boolean;
  onClosePageExtractionModal: () => void;
  extractionTargetName: string;
  extractionSourceDocuments: {
    documentId: string;
    documentName: string;
    url: string;
    globalStart: number;
    globalEnd: number;
    pageCount: number;
  }[];
  isSelecting?: boolean;
}

const PDFViewerOverlays: React.FC<PDFViewerOverlaysProps> = (props) => (
  <>
    {props.selectedText && props.selectionPosition && !props.isSelecting && (
      <TextSelectionPopup
        selectedText={props.selectedText}
        position={props.selectionPosition}
        onCopy={props.onCopy}
        onHighlight={props.onHighlight}
        onInsertFundamentacao={props.onInsertFundamentacao}
        onInsertComentarios={props.onInsertComentarios}
        onClose={props.onCloseSelection}
        containerRef={props.containerRef}
        hasActiveForm={props.formMode !== 'view'}
        hasFundamentacaoField={props.formMode === 'create-verba' || props.formMode === 'edit-verba'}
      />
    )}

    <PageRangeRotationModal totalPages={props.totalPages} />

    <PageExtractionModal
      isOpen={props.isPageExtractionModalOpen}
      onClose={props.onClosePageExtractionModal}
      documentName={props.extractionTargetName}
      totalPages={props.totalPages}
      sourceDocuments={props.extractionSourceDocuments}
    />
  </>
);

export default React.memo(PDFViewerOverlays);
