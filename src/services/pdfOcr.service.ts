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

const UPSERT_MAX_RETRIES = 3;
const UPSERT_RETRY_BASE_MS = 500;

async function upsertPdfTextPages(rows: object[]): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < UPSERT_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, UPSERT_RETRY_BASE_MS * attempt));
    }

    const { error } = await supabase!
      .from('pdf_text_pages')
      .upsert(rows, {
        onConflict: 'process_document_id,page_number',
        ignoreDuplicates: false,
      });

    if (!error) return;

    lastError = error;
    logger.warn(
      `Upsert attempt ${attempt + 1} failed`,
      'pdfOcr.upsertPdfTextPages',
      { attempt, code: (error as { code?: string }).code }
    );
  }

  throw lastError;
}

export async function getDocumentOcrStatus(documentId: string): Promise<OcrDocumentStatus> {
  try {
    const { data: docData } = await supabase!
      .from('process_documents')
      .select('id, has_ocr_content')
      .eq('id', documentId)
      .maybeSingle();

    const { count } = await supabase!
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
  if (results.length === 0) return true;

  try {
    const rows = results.map(result => ({
      process_document_id: documentId,
      page_number: result.pageNumber,
      text_content: result.text,
      ocr_status: 'ocr',
      word_boxes: result.wordBoxes,
    }));

    await upsertPdfTextPages(rows);

    const { error: updateError } = await supabase!
      .from('process_documents')
      .update({ has_ocr_content: true })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    return true;
  } catch (error) {
    logger.error('Failed to save OCR results', 'pdfOcr.saveOcrResults', { documentId, pageCount: results.length }, error);
    throw error;
  }
}
