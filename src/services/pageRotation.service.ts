import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

export interface PageRotation {
  id: string;
  processDocumentId: string;
  pageNumber: number;
  rotationDegrees: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageRotationMap {
  [pageNumber: number]: number;
}

export async function getPageRotations(processDocumentId: string): Promise<PageRotationMap> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pageRotation.service.getPageRotations');
      return {};
    }

    const { data, error } = await supabase
      .from('pdf_page_rotations')
      .select('page_number, rotation_degrees')
      .eq('process_document_id', processDocumentId);

    if (error) {
      logger.error('Error fetching page rotations', 'pageRotation.service.getPageRotations', undefined, error);
      return {};
    }

    if (!data || data.length === 0) {
      return {};
    }

    const rotationMap: PageRotationMap = {};
    data.forEach((row) => {
      if (row.rotation_degrees !== 0) {
        rotationMap[row.page_number] = row.rotation_degrees;
      }
    });

    return rotationMap;
  } catch (error) {
    logger.errorWithException(
      'Exception fetching page rotations',
      error as Error,
      'pageRotation.service.getPageRotations'
    );
    return {};
  }
}

export async function upsertPageRotation(
  processDocumentId: string,
  pageNumber: number,
  rotationDegrees: number
): Promise<boolean> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pageRotation.service.upsertPageRotation');
      return false;
    }
    const normalizedDegrees = ((rotationDegrees % 360) + 360) % 360;

    if (normalizedDegrees === 0) {
      return await deletePageRotation(processDocumentId, pageNumber);
    }

    const { error } = await supabase
      .from('pdf_page_rotations')
      .upsert(
        {
          process_document_id: processDocumentId,
          page_number: pageNumber,
          rotation_degrees: normalizedDegrees,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'process_document_id,page_number'
        }
      );

    if (error) {
      logger.error('Error upserting page rotation', 'pageRotation.service.upsertPageRotation', undefined, error);
      return false;
    }

    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception upserting page rotation',
      error as Error,
      'pageRotation.service.upsertPageRotation'
    );
    return false;
  }
}

export async function upsertPageRotations(
  processDocumentId: string,
  rotations: Array<{ pageNumber: number; rotationDegrees: number }>
): Promise<boolean> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pageRotation.service.upsertPageRotations');
      return false;
    }

    const toDelete: number[] = [];
    const toUpsert: Array<{
      process_document_id: string;
      page_number: number;
      rotation_degrees: number;
      updated_at: string;
    }> = [];

    rotations.forEach(({ pageNumber, rotationDegrees }) => {
      const normalizedDegrees = ((rotationDegrees % 360) + 360) % 360;
      if (normalizedDegrees === 0) {
        toDelete.push(pageNumber);
      } else {
        toUpsert.push({
          process_document_id: processDocumentId,
          page_number: pageNumber,
          rotation_degrees: normalizedDegrees,
          updated_at: new Date().toISOString()
        });
      }
    });

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('pdf_page_rotations')
        .delete()
        .eq('process_document_id', processDocumentId)
        .in('page_number', toDelete);

      if (deleteError) {
        logger.error(
          'Error deleting zero rotations',
          'pageRotation.service.upsertPageRotations',
          undefined,
          deleteError
        );
        return false;
      }
    }

    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('pdf_page_rotations')
        .upsert(toUpsert, {
          onConflict: 'process_document_id,page_number'
        });

      if (upsertError) {
        logger.error(
          'Error upserting rotations',
          'pageRotation.service.upsertPageRotations',
          undefined,
          upsertError
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception batch upserting page rotations',
      error as Error,
      'pageRotation.service.upsertPageRotations'
    );
    return false;
  }
}

export async function deletePageRotation(
  processDocumentId: string,
  pageNumber: number
): Promise<boolean> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pageRotation.service.deletePageRotation');
      return false;
    }

    const { error } = await supabase
      .from('pdf_page_rotations')
      .delete()
      .eq('process_document_id', processDocumentId)
      .eq('page_number', pageNumber);

    if (error) {
      logger.error('Error deleting page rotation', 'pageRotation.service.deletePageRotation', undefined, error);
      return false;
    }

    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception deleting page rotation',
      error as Error,
      'pageRotation.service.deletePageRotation'
    );
    return false;
  }
}

export async function deleteAllPageRotations(processDocumentId: string): Promise<boolean> {
  try {
    if (!supabase) {
      logger.warn('Supabase client unavailable', 'pageRotation.service.deleteAllPageRotations');
      return false;
    }

    const { error } = await supabase
      .from('pdf_page_rotations')
      .delete()
      .eq('process_document_id', processDocumentId);

    if (error) {
      logger.error(
        'Error deleting all page rotations',
        'pageRotation.service.deleteAllPageRotations',
        undefined,
        error
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.errorWithException(
      'Exception deleting all page rotations',
      error as Error,
      'pageRotation.service.deleteAllPageRotations'
    );
    return false;
  }
}
