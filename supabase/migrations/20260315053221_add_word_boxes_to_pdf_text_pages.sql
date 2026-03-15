/*
  # Add word_boxes column to pdf_text_pages

  ## Summary
  Adds a JSONB column `word_boxes` to the `pdf_text_pages` table to store
  per-word bounding box data extracted from Tesseract OCR.

  ## Changes

  ### Modified Tables
  - `pdf_text_pages`
    - `word_boxes` (jsonb, nullable): Array of word objects with text and
      coordinates in OCR canvas space (rendered at 2x PDF scale).
      Structure: `[{ text: string, x: number, y: number, w: number, h: number }]`

  ## Notes
  - Existing OCR rows (ocr_status = 'ocr') that have no word_boxes will be
    reset to ocr_status = 'extracted' so the UI can prompt the user to re-run
    OCR and obtain the aligned word box data.
  - Rows with ocr_status != 'ocr' (i.e. native PDF text layer extractions)
    are unaffected — they never had an overlay.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_text_pages' AND column_name = 'word_boxes'
  ) THEN
    ALTER TABLE pdf_text_pages ADD COLUMN word_boxes jsonb DEFAULT NULL;
  END IF;
END $$;

UPDATE pdf_text_pages
SET ocr_status = 'extracted'
WHERE ocr_status = 'ocr'
  AND (word_boxes IS NULL OR jsonb_array_length(word_boxes) = 0);
