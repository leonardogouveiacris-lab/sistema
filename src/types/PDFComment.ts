export type CommentColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange' | 'red';

export type ConnectorType = 'arrow' | 'highlightbox';

export interface PDFComment {
  id: string;
  processDocumentId: string;
  pageNumber: number;
  content: string;
  positionX: number;
  positionY: number;
  color: CommentColor;
  isMinimized: boolean;
  connectors?: PDFCommentConnector[];
  createdAt: string;
  updatedAt: string;
}

export interface PDFCommentConnector {
  id: string;
  commentId: string;
  connectorType: ConnectorType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX?: number;
  controlY?: number;
  textContent?: string;
  boxWidth?: number;
  boxHeight?: number;
  strokeColor: string;
  strokeWidth: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  processDocumentId: string;
  pageNumber: number;
  content?: string;
  positionX: number;
  positionY: number;
  color?: CommentColor;
}

export interface UpdateCommentInput {
  content?: string;
  positionX?: number;
  positionY?: number;
  color?: CommentColor;
  isMinimized?: boolean;
}

export interface CreateConnectorInput {
  commentId: string;
  connectorType: ConnectorType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX?: number;
  controlY?: number;
  textContent?: string;
  boxWidth?: number;
  boxHeight?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface UpdateConnectorInput {
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  controlX?: number;
  controlY?: number;
  textContent?: string;
  boxWidth?: number;
  boxHeight?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export const COMMENT_COLORS: Record<CommentColor, { bg: string; border: string; icon: string }> = {
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-400', icon: 'text-yellow-600' },
  green: { bg: 'bg-green-100', border: 'border-green-400', icon: 'text-green-600' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-400', icon: 'text-blue-600' },
  pink: { bg: 'bg-pink-100', border: 'border-pink-400', icon: 'text-pink-600' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-400', icon: 'text-purple-600' },
  orange: { bg: 'bg-orange-100', border: 'border-orange-400', icon: 'text-orange-600' },
  red: { bg: 'bg-red-100', border: 'border-red-400', icon: 'text-red-600' }
};

export const COMMENT_COLOR_VALUES: Record<CommentColor, string> = {
  yellow: '#fef08a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
  orange: '#fed7aa',
  red: '#fecaca'
};
