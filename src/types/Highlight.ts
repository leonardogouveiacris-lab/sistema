/**
 * Types for PDF text highlighting system
 */

import { BaseEntity } from './Common';

/**
 * Available highlight colors
 */
export const HIGHLIGHT_COLORS = [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
  'orange'
] as const;

export type HighlightColor = typeof HIGHLIGHT_COLORS[number];

/**
 * Single rectangle for a text fragment
 */
export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position data for rendering highlight on PDF
 * Supports multiple rectangles for multi-line text selections
 */
export interface HighlightPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  rects?: HighlightRect[];
}

/**
 * Coordinate version for highlights
 * 1 = Legacy format (coordinates normalized/divided by zoom)
 * 2 = New format (coordinates in page pixels, no zoom normalization)
 */
export type CoordinateVersion = 1 | 2;

/**
 * PDF Highlight entity
 */
export interface PDFHighlight extends BaseEntity {
  processId: string;
  processDocumentId: string;
  pageNumber: number;
  selectedText: string;
  positionData: HighlightPosition;
  color: HighlightColor;
  lancamentoId?: string;
  coordinateVersion: CoordinateVersion;
}

/**
 * Data for creating a new highlight
 */
export interface NewPDFHighlight {
  processId: string;
  processDocumentId: string;
  pageNumber: number;
  selectedText: string;
  positionData: HighlightPosition;
  color: HighlightColor;
}

/**
 * Filter for querying highlights
 */
export interface HighlightFilter {
  processId?: string;
  processDocumentId?: string;
  pageNumber?: number;
  color?: HighlightColor;
}

/**
 * Color configuration for rendering highlights
 * Styled to match Adobe Acrobat's highlight appearance
 */
export const HIGHLIGHT_COLOR_CONFIG: Record<HighlightColor, { bg: string; border: string; opacity: string }> = {
  yellow: {
    bg: 'bg-yellow-400',
    border: 'border-yellow-400/20',
    opacity: 'bg-opacity-35'
  },
  green: {
    bg: 'bg-green-400',
    border: 'border-green-400/20',
    opacity: 'bg-opacity-35'
  },
  blue: {
    bg: 'bg-blue-400',
    border: 'border-blue-400/20',
    opacity: 'bg-opacity-35'
  },
  pink: {
    bg: 'bg-pink-400',
    border: 'border-pink-400/20',
    opacity: 'bg-opacity-35'
  },
  purple: {
    bg: 'bg-purple-400',
    border: 'border-purple-400/20',
    opacity: 'bg-opacity-35'
  },
  orange: {
    bg: 'bg-orange-400',
    border: 'border-orange-400/20',
    opacity: 'bg-opacity-35'
  }
};
