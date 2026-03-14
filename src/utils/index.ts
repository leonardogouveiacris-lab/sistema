/**
 * Barrel export para utilitários
 * 
 * Este arquivo centraliza todos os utilitários do sistema,
 * fornecendo um ponto único de importação para facilitar
 * o uso e manutenção das dependências
 */

// Utilitários principais
export { default as logger } from './logger';
export { default as ValidationUtils } from './validation';
export { default as errorHandler } from './errorHandler';
export { default as TipoVerbaNormalizer } from './tipoVerbaNormalizer';

// Utilitários de exportação HTML (usados pelo PDFExporter)
export { default as HTMLFormatter } from './htmlFormatter';
export { default as HTMLTemplate } from './htmlTemplate';
export { default as HTMLHeaderFooter } from './htmlHeader';

// Utilitários de exportação PDF
export { default as PDFExporter } from './pdfExporter';

// Utilitários de formatação de texto
export { formatPDFText, formatPDFTextAdvanced } from './textFormatter';

// Utilitários de preview de texto
export { stripHtml, getPreviewText, hasLongText, PREVIEW_LENGTHS } from './previewText';

// Utilitários de manipulação de retângulos
export { mergeRectsIntoLines } from './rectMerger';

// Utilitários de performance
export {
  debounce,
  throttle,
  memoize,
  runWhenIdle,
  batchOnAnimationFrame,
  generatePDFCacheKey,
  saveBookmarksToCache,
  loadBookmarksFromCache,
  clearOldBookmarkCaches
} from './performance';

// Utilitários de relatório
export * from './reportUtils';
export * from './sharedReportUtils';

// Re-exports nomeados para facilitar uso
export * from './logger';          // LogLevel, etc.
export * from './validation';      // ValidationResult, etc.
export * from './errorHandler';    // ErrorType, SystemError, etc.
export * from './tipoVerbaNormalizer'; // TipoValidationResult, etc.
export * from './textFormatter';   // TextFormatterOptions, etc.
export * from './performance';     // debounce, throttle, etc.