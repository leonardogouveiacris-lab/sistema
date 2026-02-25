import { supabase } from '../lib/supabase';
import { ErrorType, SystemError } from '../utils/errorHandler';
import {
  PDFComment,
  PDFCommentConnector,
  CreateCommentInput,
  UpdateCommentInput,
  CreateConnectorInput,
  UpdateConnectorInput
} from '../types/PDFComment';
import logger from '../utils/logger';
import { createFlowContext, generateFlowId } from '../utils/flowId';

interface LogOptions {
  flowId?: string;
}

const mapCommentFromDB = (row: Record<string, unknown>): PDFComment => ({
  id: row.id as string,
  processDocumentId: row.process_document_id as string,
  pageNumber: row.page_number as number,
  content: row.content as string,
  positionX: row.position_x as number,
  positionY: row.position_y as number,
  color: row.color as PDFComment['color'],
  isMinimized: row.is_minimized as boolean,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

const mapConnectorFromDB = (row: Record<string, unknown>): PDFCommentConnector => ({
  id: row.id as string,
  commentId: row.comment_id as string,
  connectorType: row.connector_type as PDFCommentConnector['connectorType'],
  startX: row.start_x as number,
  startY: row.start_y as number,
  endX: row.end_x as number,
  endY: row.end_y as number,
  controlX: row.control_x as number | undefined,
  controlY: row.control_y as number | undefined,
  textContent: row.text_content as string | undefined,
  boxWidth: row.box_width as number | undefined,
  boxHeight: row.box_height as number | undefined,
  strokeColor: row.stroke_color as string,
  strokeWidth: row.stroke_width as number,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export async function getCommentsByDocument(processDocumentId: string): Promise<PDFComment[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('pdf_comments')
    .select('*')
    .eq('process_document_id', processDocumentId)
    .order('page_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCommentFromDB);
}

export async function getCommentsByPage(
  processDocumentId: string,
  pageNumber: number
): Promise<PDFComment[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('pdf_comments')
    .select('*')
    .eq('process_document_id', processDocumentId)
    .eq('page_number', pageNumber)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCommentFromDB);
}

export async function getCommentWithConnectors(commentId: string): Promise<PDFComment | null> {
  if (!supabase) {
    return null;
  }
  const { data: commentData, error: commentError } = await supabase
    .from('pdf_comments')
    .select('*')
    .eq('id', commentId)
    .maybeSingle();

  if (commentError) throw commentError;
  if (!commentData) return null;

  const { data: connectorsData, error: connectorsError } = await supabase
    .from('pdf_comment_connectors')
    .select('*')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: true });

  if (connectorsError) throw connectorsError;

  const comment = mapCommentFromDB(commentData);
  comment.connectors = (connectorsData || []).map(mapConnectorFromDB);

  return comment;
}

export async function getCommentsWithConnectorsByDocument(
  processDocumentId: string
): Promise<PDFComment[]> {
  if (!supabase) {
    return [];
  }
  const comments = await getCommentsByDocument(processDocumentId);

  if (comments.length === 0) return [];

  const commentIds = comments.map(c => c.id);

  const { data: connectorsData, error: connectorsError } = await supabase
    .from('pdf_comment_connectors')
    .select('*')
    .in('comment_id', commentIds)
    .order('created_at', { ascending: true });

  if (connectorsError) throw connectorsError;

  const connectorsByComment = new Map<string, PDFCommentConnector[]>();
  (connectorsData || []).forEach(row => {
    const connector = mapConnectorFromDB(row);
    const existing = connectorsByComment.get(connector.commentId) || [];
    existing.push(connector);
    connectorsByComment.set(connector.commentId, existing);
  });

  return comments.map(comment => ({
    ...comment,
    connectors: connectorsByComment.get(comment.id) || []
  }));
}

export async function createComment(input: CreateCommentInput, options: LogOptions = {}): Promise<PDFComment> {
  const flowId = options.flowId || generateFlowId();

  if (!supabase) {
    logger.warn('Supabase client unavailable', 'PDFCommentsService.createComment', {
      metadata: createFlowContext({
        flowId,
        entityType: 'comment',
        action: 'create',
        source: 'PDFCommentsService.createComment'
      })
    });
    throw new SystemError(
      'Supabase não configurado',
      ErrorType.SYSTEM,
      'SUPABASE_UNAVAILABLE',
      undefined,
      'PDFCommentsService.createComment'
    );
  }
  const { data, error } = await supabase
    .from('pdf_comments')
    .insert({
      process_document_id: input.processDocumentId,
      page_number: input.pageNumber,
      content: input.content || '',
      position_x: input.positionX,
      position_y: input.positionY,
      color: input.color || 'yellow'
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating comment', 'PDFCommentsService.createComment', {
      metadata: createFlowContext({
        flowId,
        entityType: 'comment',
        action: 'create',
        source: 'PDFCommentsService.createComment'
      })
    }, error);
    throw error;
  }

  const createdComment = mapCommentFromDB(data);
  return createdComment;
}

export async function updateComment(
  commentId: string,
  input: UpdateCommentInput
): Promise<PDFComment> {
  if (!supabase) {
    throw new SystemError(
      'Supabase não configurado',
      ErrorType.SYSTEM,
      'SUPABASE_UNAVAILABLE',
      undefined,
      'PDFCommentsService.updateComment'
    );
  }
  const updateData: Record<string, unknown> = {};

  if (input.content !== undefined) updateData.content = input.content;
  if (input.positionX !== undefined) updateData.position_x = input.positionX;
  if (input.positionY !== undefined) updateData.position_y = input.positionY;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.isMinimized !== undefined) updateData.is_minimized = input.isMinimized;

  const { data, error } = await supabase
    .from('pdf_comments')
    .update(updateData)
    .eq('id', commentId)
    .select()
    .single();

  if (error) throw error;
  return mapCommentFromDB(data);
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!supabase) {
    throw new SystemError(
      'Supabase não configurado',
      ErrorType.SYSTEM,
      'SUPABASE_UNAVAILABLE',
      undefined,
      'PDFCommentsService.deleteComment'
    );
  }
  const { error } = await supabase
    .from('pdf_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

export async function getConnectorsByComment(commentId: string): Promise<PDFCommentConnector[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('pdf_comment_connectors')
    .select('*')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapConnectorFromDB);
}

export async function createConnector(input: CreateConnectorInput, options: LogOptions = {}): Promise<PDFCommentConnector> {
  const flowId = options.flowId || generateFlowId();

  if (!supabase) {
    logger.warn('Supabase client unavailable', 'PDFCommentsService.createConnector', {
      metadata: createFlowContext({
        flowId,
        entityType: 'connector',
        action: 'create',
        source: 'PDFCommentsService.createConnector'
      })
    });
    throw new SystemError(
      'Supabase não configurado',
      ErrorType.SYSTEM,
      'SUPABASE_UNAVAILABLE',
      undefined,
      'PDFCommentsService.createConnector'
    );
  }
  const { data, error } = await supabase
    .from('pdf_comment_connectors')
    .insert({
      comment_id: input.commentId,
      connector_type: input.connectorType,
      start_x: input.startX,
      start_y: input.startY,
      end_x: input.endX,
      end_y: input.endY,
      control_x: input.controlX,
      control_y: input.controlY,
      text_content: input.textContent,
      box_width: input.boxWidth,
      box_height: input.boxHeight,
      stroke_color: input.strokeColor || '#374151',
      stroke_width: input.strokeWidth || 2
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating connector', 'PDFCommentsService.createConnector', {
      metadata: createFlowContext({
        flowId,
        entityType: 'connector',
        action: 'create',
        source: 'PDFCommentsService.createConnector'
      })
    }, error);
    throw error;
  }

  const createdConnector = mapConnectorFromDB(data);

  return createdConnector;
}

export async function updateConnector(
  connectorId: string,
  input: UpdateConnectorInput
): Promise<PDFCommentConnector> {
  if (!supabase) {
    throw new SystemError(
      'Supabase não configurado',
      ErrorType.SYSTEM,
      'SUPABASE_UNAVAILABLE',
      undefined,
      'PDFCommentsService.updateConnector'
    );
  }
  const updateData: Record<string, unknown> = {};

  if (input.startX !== undefined) updateData.start_x = input.startX;
  if (input.startY !== undefined) updateData.start_y = input.startY;
  if (input.endX !== undefined) updateData.end_x = input.endX;
  if (input.endY !== undefined) updateData.end_y = input.endY;
  if (input.controlX !== undefined) updateData.control_x = input.controlX;
  if (input.controlY !== undefined) updateData.control_y = input.controlY;
  if (input.textContent !== undefined) updateData.text_content = input.textContent;
  if (input.boxWidth !== undefined) updateData.box_width = input.boxWidth;
  if (input.boxHeight !== undefined) updateData.box_height = input.boxHeight;
  if (input.strokeColor !== undefined) updateData.stroke_color = input.strokeColor;
  if (input.strokeWidth !== undefined) updateData.stroke_width = input.strokeWidth;

  const { data, error } = await supabase
    .from('pdf_comment_connectors')
    .update(updateData)
    .eq('id', connectorId)
    .select()
    .single();

  if (error) throw error;
  return mapConnectorFromDB(data);
}

export async function deleteConnector(connectorId: string): Promise<void> {
  if (!supabase) {
    throw new SystemError(
      'Supabase não configurado',
      ErrorType.SYSTEM,
      'SUPABASE_UNAVAILABLE',
      undefined,
      'PDFCommentsService.deleteConnector'
    );
  }
  const { error } = await supabase
    .from('pdf_comment_connectors')
    .delete()
    .eq('id', connectorId);

  if (error) throw error;
}
