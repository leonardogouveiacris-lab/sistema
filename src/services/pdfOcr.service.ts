import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

export interface OcrWordBox {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  wordBoxes: OcrWordBox[];
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
        await supabase
          .from('pdf_text_pages')
          .update({
            text_content: result.text,
            ocr_status: 'ocr',
            word_boxes: result.wordBoxes,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('pdf_text_pages')
          .insert({
            process_document_id: documentId,
            page_number: result.pageNumber,
            text_content: result.text,
            ocr_status: 'ocr',
            word_boxes: result.wordBoxes,
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
