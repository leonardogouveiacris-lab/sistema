import { useCallback } from 'react';
import { usePDFViewer } from '../contexts/PDFViewerContext';
import { useTableViewer } from '../contexts/TableViewerContext';
import { LancamentoReferenceItem } from './useLancamentosForReference';
import ProcessDocumentService from '../services/processDocument.service';

export function useNavigateToReference(processId: string) {
  const {
    state: pdfState,
    openViewer,
    navigateToPageWithHighlight,
    scrollToMultipleHighlights,
    setPendingNavigation,
  } = usePDFViewer();

  const {
    state: tableState,
    openTableViewer,
    toggleMinimize,
  } = useTableViewer();

  const navigate = useCallback(async (item: LancamentoReferenceItem) => {
    if (item.type === 'tabela') {
      if (!tableState.isOpen) {
        openTableViewer(processId);
        setTimeout(() => {
          document.getElementById('process-tabela-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      } else {
        if (tableState.isMinimized) {
          toggleMinimize();
        }
        setTimeout(() => {
          document.getElementById('process-tabela-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      return;
    }

    if (!item.paginaVinculada) return;

    const viewerAlreadyOpen = pdfState.isOpen;
    const viewerHasDocument =
      viewerAlreadyOpen &&
      (!item.processDocumentId ||
        pdfState.documents.some(d => d.id === item.processDocumentId));

    if (viewerHasDocument) {
      if (pdfState.isMinimized) {
        openViewer(pdfState.documents);
      }
      if (item.highlightIds?.length) {
        scrollToMultipleHighlights(item.highlightIds, item.paginaVinculada);
      } else {
        navigateToPageWithHighlight(item.paginaVinculada, item.id);
      }
      return;
    }

    if (item.highlightIds?.length) {
      setPendingNavigation({
        type: 'highlights',
        highlightIds: item.highlightIds,
        page: item.paginaVinculada,
        targetDocumentId: item.processDocumentId,
      });
    } else {
      setPendingNavigation({
        type: 'page',
        page: item.paginaVinculada,
        recordId: item.id,
        targetDocumentId: item.processDocumentId,
      });
    }

    try {
      const docs = await ProcessDocumentService.getDocumentsByProcessId(processId);
      if (docs.length === 0) return;

      if (item.processDocumentId) {
        const targetDoc = docs.find(d => d.id === item.processDocumentId);
        if (targetDoc) {
          const reordered = [targetDoc, ...docs.filter(d => d.id !== targetDoc.id)];
          openViewer(reordered);
          return;
        }
      }

      openViewer(docs);
    } catch {
      setPendingNavigation(null);
    }
  }, [
    processId,
    pdfState,
    tableState,
    openViewer,
    navigateToPageWithHighlight,
    scrollToMultipleHighlights,
    setPendingNavigation,
    openTableViewer,
    toggleMinimize,
  ]);

  return navigate;
}
