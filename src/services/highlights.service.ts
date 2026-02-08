/**
 * Service for managing PDF highlights
 * Handles CRUD operations for text highlights in PDF documents
 */

import { supabase } from '../lib/supabase';
import { PDFHighlight, NewPDFHighlight, HighlightFilter } from '../types/Highlight';
import logger from '../utils/logger';

/**
 * Create a new highlight
 */
export async function createHighlight(
  data: NewPDFHighlight,
  lancamentoId?: string
): Promise<PDFHighlight | null> {
  try {
    logger.info('Creating highlight', 'highlights.service.createHighlight', {
      processId: data.processId,
      pageNumber: data.pageNumber,
      color: data.color,
      lancamentoId
    });

    const { data: highlight, error } = await supabase
      .from('pdf_highlights')
      .insert({
        process_id: data.processId,
        process_document_id: data.processDocumentId,
        page_number: data.pageNumber,
        selected_text: data.selectedText,
        position_data: data.positionData,
        color: data.color,
        lancamento_id: lancamentoId || null
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Error creating highlight', 'highlights.service.createHighlight', undefined, error);
      return null;
    }

    if (!highlight) {
      logger.warn('No highlight returned after creation', 'highlights.service.createHighlight');
      return null;
    }

    logger.success('Highlight created successfully', 'highlights.service.createHighlight', { id: highlight.id });

    return {
      id: highlight.id,
      processId: highlight.process_id,
      processDocumentId: highlight.process_document_id,
      pageNumber: highlight.page_number,
      selectedText: highlight.selected_text,
      positionData: highlight.position_data,
      color: highlight.color,
      lancamentoId: highlight.lancamento_id,
      coordinateVersion: highlight.coordinate_version || 2,
      createdAt: highlight.created_at,
      updatedAt: highlight.updated_at
    };
  } catch (error) {
    logger.errorWithException(
      'Exception creating highlight',
      error as Error,
      'highlights.service.createHighlight'
    );
    return null;
  }
}

/**
 * Get highlights by filter
 */
export async function getHighlights(filter: HighlightFilter = {}): Promise<PDFHighlight[]> {
  try {
    logger.info('Fetching highlights', 'highlights.service.getHighlights', filter);

    let query = supabase
      .from('pdf_highlights')
      .select('*')
      .order('page_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (filter.processId) {
      query = query.eq('process_id', filter.processId);
    }

    if (filter.processDocumentId) {
      query = query.eq('process_document_id', filter.processDocumentId);
    }

    if (filter.pageNumber !== undefined) {
      query = query.eq('page_number', filter.pageNumber);
    }

    if (filter.color) {
      query = query.eq('color', filter.color);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching highlights', 'highlights.service.getHighlights', undefined, error);
      return [];
    }

    if (!data || data.length === 0) {
      logger.info('No highlights found', 'highlights.service.getHighlights', filter);
      return [];
    }

    logger.success(
      `Fetched ${data.length} highlights`,
      'highlights.service.getHighlights',
      { count: data.length }
    );

    return data.map((highlight) => {
      return {
        id: highlight.id,
        processId: highlight.process_id,
        processDocumentId: highlight.process_document_id,
        pageNumber: highlight.page_number,
        selectedText: highlight.selected_text,
        positionData: highlight.position_data,
        color: highlight.color,
        lancamentoId: highlight.lancamento_id,
        coordinateVersion: highlight.coordinate_version || 1,
        createdAt: highlight.created_at,
        updatedAt: highlight.updated_at
      };
    });
  } catch (error) {
    logger.errorWithException(
      'Exception fetching highlights',
      error as Error,
      'highlights.service.getHighlights'
    );
    return [];
  }
}

/**
 * Update highlight color
 */
export async function updateHighlightColor(
  id: string,
  color: string
): Promise<boolean> {
  try {
    logger.info('Updating highlight color', 'highlights.service.updateHighlightColor', { id, color });

    const { error } = await supabase
      .from('pdf_highlights')
      .update({
        color,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      logger.error('Error updating highlight color', 'highlights.service.updateHighlightColor', undefined, error);
      return false;
    }

    logger.success('Highlight color updated successfully', 'highlights.service.updateHighlightColor', { id });
    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception updating highlight color',
      error as Error,
      'highlights.service.updateHighlightColor'
    );
    return false;
  }
}

/**
 * Delete a highlight and remove its ID from all lancamentos that reference it
 */
export async function deleteHighlight(id: string): Promise<boolean> {
  try {
    logger.info('Deleting highlight', 'highlights.service.deleteHighlight', { id });

    const { data: existing, error: checkError } = await supabase
      .from('pdf_highlights')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      logger.error('Error checking highlight existence', 'highlights.service.deleteHighlight', undefined, checkError);
      return false;
    }

    if (!existing) {
      logger.warn('Highlight not found for deletion', 'highlights.service.deleteHighlight', { id });
      return false;
    }

    const { error: removeFromVerbaError } = await supabase.rpc('remove_highlight_id_from_verba_lancamentos', {
      highlight_id_to_remove: id
    });

    if (removeFromVerbaError) {
      logger.warn(
        'Error removing highlight from verba_lancamentos',
        'highlights.service.deleteHighlight',
        removeFromVerbaError
      );
    }

    const { error: removeFromDocError } = await supabase.rpc('remove_highlight_id_from_lancamentos_documentos', {
      highlight_id_to_remove: id
    });

    if (removeFromDocError) {
      logger.warn(
        'Error removing highlight from lancamentos_documentos',
        'highlights.service.deleteHighlight',
        removeFromDocError
      );
    }

    const { error, count } = await supabase
      .from('pdf_highlights')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      logger.error('Error deleting highlight', 'highlights.service.deleteHighlight', undefined, error);
      return false;
    }

    logger.success('Highlight deleted successfully', 'highlights.service.deleteHighlight', {
      id,
      deletedCount: count
    });

    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception deleting highlight',
      error as Error,
      'highlights.service.deleteHighlight'
    );
    return false;
  }
}

/**
 * Delete all highlights for a process
 */
export async function deleteHighlightsByProcess(processId: string): Promise<boolean> {
  try {
    logger.info('Deleting highlights for process', 'highlights.service.deleteHighlightsByProcess', {
      processId
    });

    const { error } = await supabase
      .from('pdf_highlights')
      .delete()
      .eq('process_id', processId);

    if (error) {
      logger.error(
        'Error deleting highlights for process',
        'highlights.service.deleteHighlightsByProcess',
        error
      );
      return false;
    }

    logger.success(
      'Highlights deleted successfully for process',
      'highlights.service.deleteHighlightsByProcess',
      { processId }
    );
    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception deleting highlights for process',
      error as Error,
      'highlights.service.deleteHighlightsByProcess'
    );
    return false;
  }
}

/**
 * Delete all highlights for a document
 */
export async function deleteHighlightsByDocument(processDocumentId: string): Promise<boolean> {
  try {
    logger.info(
      'Deleting highlights for document',
      'highlights.service.deleteHighlightsByDocument',
      { processDocumentId }
    );

    const { error } = await supabase
      .from('pdf_highlights')
      .delete()
      .eq('process_document_id', processDocumentId);

    if (error) {
      logger.error(
        'Error deleting highlights for document',
        'highlights.service.deleteHighlightsByDocument',
        error
      );
      return false;
    }

    logger.success(
      'Highlights deleted successfully for document',
      'highlights.service.deleteHighlightsByDocument',
      { processDocumentId }
    );
    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception deleting highlights for document',
      error as Error,
      'highlights.service.deleteHighlightsByDocument'
    );
    return false;
  }
}

/**
 * Get highlight by lancamento ID
 */
export async function getHighlightByLancamentoId(lancamentoId: string): Promise<PDFHighlight | null> {
  try {
    logger.info('Fetching highlight by lancamento ID', 'highlights.service.getHighlightByLancamentoId', {
      lancamentoId
    });

    const { data, error } = await supabase
      .from('pdf_highlights')
      .select('*')
      .eq('lancamento_id', lancamentoId)
      .maybeSingle();

    if (error) {
      logger.error(
        'Error fetching highlight by lancamento ID',
        'highlights.service.getHighlightByLancamentoId',
        undefined,
        error
      );
      return null;
    }

    if (!data) {
      logger.info('No highlight found for lancamento ID', 'highlights.service.getHighlightByLancamentoId', {
        lancamentoId
      });
      return null;
    }

    logger.success('Highlight found for lancamento ID', 'highlights.service.getHighlightByLancamentoId', {
      highlightId: data.id
    });

    return {
      id: data.id,
      processId: data.process_id,
      processDocumentId: data.process_document_id,
      pageNumber: data.page_number,
      selectedText: data.selected_text,
      positionData: data.position_data,
      color: data.color,
      lancamentoId: data.lancamento_id,
      coordinateVersion: data.coordinate_version || 1,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    logger.errorWithException(
      'Exception fetching highlight by lancamento ID',
      error as Error,
      'highlights.service.getHighlightByLancamentoId'
    );
    return null;
  }
}
