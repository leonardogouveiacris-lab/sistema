import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrDocumentStatus {
  documentId: string;
  hasOcrContent: boolean;
  ocrPageCount: number;
}

export async function getDocumentOcrStatus(documentId: string): Promise<OcrDocumentStatus> {
  try {
    const { data: docData } = await supabase
      .from('process_documents')
      .select('id, has_ocr_content')
      .eq('id', documentId)
      .maybeSingle();

    const { count } = await supabase
      .from('pdf_text_pages')
      .select('id', { count: 'exact', head: true })
      .eq('process_document_id', documentId)
      .eq('ocr_status', 'ocr');

    return {
      documentId,
      hasOcrContent: docData?.has_ocr_content ?? false,
      ocrPageCount: count ?? 0,
    };
  } catch (error) {
    logger.error('Failed to get OCR status', 'pdfOcr.getDocumentOcrStatus', { documentId }, error);
    return { documentId, hasOcrContent: false, ocrPageCount: 0 };
  }
}

export async function getPageTextDensity(documentId: string, totalPages: number): Promise<Map<number, number>> {
  const densityMap = new Map<number, number>();
  try {
    const { data } = await supabase
      .from('pdf_text_pages')
      .select('page_number, text_content, ocr_status')
      .eq('process_document_id', documentId);

    if (data) {
      for (const row of data) {
        densityMap.set(row.page_number, row.text_content?.trim().length ?? 0);
      }
    }

    for (let page = 1; page <= totalPages; page++) {
      if (!densityMap.has(page)) {
        densityMap.set(page, 0);
      }
    }
  } catch (error) {
    logger.error('Failed to get page text density', 'pdfOcr.getPageTextDensity', { documentId }, error);
    for (let page = 1; page <= totalPages; page++) {
      densityMap.set(page, 0);
    }
  }
  return densityMap;
}

export async function saveOcrResults(
  documentId: string,
  results: OcrPageResult[]
): Promise<boolean> {
  try {
    for (const result of results) {
      const { data: existing } = await supabase
        .from('pdf_text_pages')
        .select('id, ocr_status')
        .eq('process_document_id', documentId)
        .eq('page_number', result.pageNumber)
        .maybeSingle();

      if (existing) {
        if (existing.ocr_status !== 'ocr') {
          await supabase
            .from('pdf_text_pages')
            .update({ text_content: result.text, ocr_status: 'ocr' })
            .eq('id', existing.id);
        }
      } else {
        await supabase
          .from('pdf_text_pages')
          .insert({
            process_document_id: documentId,
            page_number: result.pageNumber,
            text_content: result.text,
            ocr_status: 'ocr',
          });
      }
    }

    await supabase
      .from('process_documents')
      .update({ has_ocr_content: true })
      .eq('id', documentId);

    return true;
  } catch (error) {
    logger.error('Failed to save OCR results', 'pdfOcr.saveOcrResults', { documentId }, error);
    return false;
  }
}

export function detectLowTextPages(
  densityMap: Map<number, number>,
  threshold = 50
): number[] {
  const lowTextPages: number[] = [];
  densityMap.forEach((charCount, pageNumber) => {
    if (charCount < threshold) {
      lowTextPages.push(pageNumber);
    }
  });
  return lowTextPages.sort((a, b) => a - b);
}
