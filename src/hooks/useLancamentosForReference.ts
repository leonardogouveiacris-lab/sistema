import { useMemo } from 'react';
import { useVerbaContext } from '../contexts/VerbaContext';
import { useDocumentoContext } from '../contexts/DocumentoContext';
import { useDecisionContext } from '../contexts/DecisionContext';

export type LancamentoRefType = 'verba' | 'documento' | 'decisao';

export interface LancamentoReferenceItem {
  id: string;
  type: LancamentoRefType;
  label: string;
  sublabel: string;
  paginaVinculada?: number;
  highlightIds?: string[];
  processDocumentId?: string;
}

export function useLancamentosForReference(processId: string): LancamentoReferenceItem[] {
  const { verbas } = useVerbaContext();
  const { documentos } = useDocumentoContext();
  const { decisions } = useDecisionContext();

  return useMemo(() => {
    const items: LancamentoReferenceItem[] = [];

    verbas
      .filter(v => v.processId === processId)
      .forEach(verba => {
        verba.lancamentos.forEach(lanc => {
          items.push({
            id: lanc.id,
            type: 'verba',
            label: verba.tipoVerba,
            sublabel: lanc.situacao || lanc.decisaoVinculada || '',
            paginaVinculada: lanc.paginaVinculada,
            highlightIds: lanc.highlightIds,
            processDocumentId: lanc.processDocumentId,
          });
        });
      });

    documentos
      .filter(d => d.processId === processId)
      .forEach(doc => {
        items.push({
          id: doc.id,
          type: 'documento',
          label: doc.tipoDocumento,
          sublabel: doc.paginaVinculada ? `p.${doc.paginaVinculada}` : '',
          paginaVinculada: doc.paginaVinculada,
          highlightIds: doc.highlightIds,
          processDocumentId: doc.processDocumentId,
        });
      });

    decisions
      .filter(d => d.processId === processId)
      .forEach(dec => {
        items.push({
          id: dec.id,
          type: 'decisao',
          label: dec.tipoDecisao,
          sublabel: dec.situacao || '',
          paginaVinculada: dec.paginaVinculada,
          processDocumentId: dec.processDocumentId,
        });
      });

    return items;
  }, [verbas, documentos, decisions, processId]);
}
