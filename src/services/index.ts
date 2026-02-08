/**
 * Barrel export para todos os serviços
 * 
 * Centraliza a exportação de todos os serviços da aplicação,
 * facilitando a importação e organização das dependências.
 */

// Serviços principais das entidades
export { ProcessesService } from './processes.service';
export { DecisionsService } from './decisions.service';
export { VerbasService } from './verbas.service';
export { DocumentosService } from './documentos.service';
export { DynamicEnumService } from './dynamicEnum.service';
export { TipoVerbaService } from './tipoVerba.service';
export { RenameService } from './rename.service';
export { default as ProcessDocumentService } from './processDocument.service';
export { documentoLancamentoService } from './documentoLancamento.service';
export * as HighlightsService from './highlights.service';
export * as PageRotationService from './pageRotation.service';
export * as PDFCommentsService from './pdfComments.service';

// Re-exports com nomes alternativos para facilitar o uso
export { ProcessesService as ProcessService } from './processes.service';
export { DecisionsService as DecisionService } from './decisions.service';
export { VerbasService as VerbaService } from './verbas.service';
export { DocumentosService as DocumentoService } from './documentos.service';
export { DynamicEnumService as DynamicEnum } from './dynamicEnum.service';
export { TipoVerbaService as TipoVerba } from './tipoVerba.service';
export { RenameService as Rename } from './rename.service';