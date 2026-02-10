/**
 * Shared utility functions for text preview functionality
 * Used across Verbas, Decisões, and Docs tabs for consistent preview behavior
 */

/**
 * Strips HTML tags from rich text content to get plain text
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 */
export const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Gets preview text from HTML or plain text content with truncation
 * @param content - HTML or plain text content
 * @param maxLength - Maximum length of preview text (default: 140)
 * @returns Truncated preview text
 */
export const getPreviewText = (content: string | undefined, maxLength = 140): string => {
  if (!content) return '';
  const text = stripHtml(content);
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

/**
 * Checks if text content is long enough to show "Ver mais" option
 * @param content - HTML or plain text content
 * @param threshold - Length threshold (default: 150)
 * @returns True if content exceeds threshold
 */
export const hasLongText = (content: string | undefined, threshold = 150): boolean => {
  if (!content) return false;
  const text = stripHtml(content);
  return text.length > threshold;
};

/**
 * Preview text length constants for consistent behavior
 */
export const PREVIEW_LENGTHS = {
  COMPACT: 140,
  DETAILED: 200,
  LIST_VIEW: 150,
} as const;
