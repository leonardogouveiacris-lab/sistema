/*
  # Add OCR Support Columns

  ## Summary
  Adds OCR-related tracking columns to support on-demand OCR processing of scanned PDFs.

  ## Changes

  ### Modified Tables

  #### `pdf_text_pages`
  - `ocr_status` (text, DEFAULT 'extracted') — indicates how the text was obtained:
    - `'extracted'`: obtained via standard PDF text layer extraction
    - `'ocr'`: obtained via OCR processing of the rendered page image
    - `'pending'`: OCR was requested but has not yet completed

  #### `process_documents`
  - `has_ocr_content` (boolean, DEFAULT false) — quick flag indicating whether
    any page of this document has been enriched with OCR text

  ## New Indexes
  - Index on `pdf_text_pages(process_document_id, ocr_status)` for efficient
    lookup of pages by their extraction method

  ## Notes
  - All existing rows are backward-compatible; new column defaults preserve
    current behavior without any data migration required.
  - `ocr_status` intentionally kept as text (not enum) to allow future values
    without DDL changes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_text_pages' AND column_name = 'ocr_status'
  ) THEN
    ALTER TABLE pdf_text_pages ADD COLUMN ocr_status text DEFAULT 'extracted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_documents' AND column_name = 'has_ocr_content'
  ) THEN
    ALTER TABLE process_documents ADD COLUMN has_ocr_content boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pdf_text_pages_ocr_status
  ON pdf_text_pages(process_document_id, ocr_status);
