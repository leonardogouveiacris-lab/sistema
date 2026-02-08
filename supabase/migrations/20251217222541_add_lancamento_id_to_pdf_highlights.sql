/*
  # Add lancamento_id to pdf_highlights table

  ## Summary
  Adds bidirectional relationship between pdf_highlights and verba_lancamentos tables
  to support automatic highlight creation when text is inserted into fundamentacao field.

  ## Changes Made
  1. Tables Modified
    - `pdf_highlights`
      - Add `lancamento_id` column (uuid, nullable)
      - Add foreign key constraint to `verba_lancamentos(id)` with ON DELETE SET NULL
      - Add index on `lancamento_id` for query performance

  ## Important Notes
  - The relationship is optional (nullable) since highlights can exist without being linked to a lancamento
  - When a verba_lancamento is deleted, the highlight remains but the link is removed (SET NULL)
  - This completes the bidirectional relationship:
    * verba_lancamentos.highlight_id -> pdf_highlights.id (already exists)
    * pdf_highlights.lancamento_id -> verba_lancamentos.id (this migration)
*/

-- Add lancamento_id column to pdf_highlights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_highlights' AND column_name = 'lancamento_id'
  ) THEN
    ALTER TABLE pdf_highlights ADD COLUMN lancamento_id uuid;
  END IF;
END $$;

-- Add foreign key constraint with ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pdf_highlights_lancamento_id_fkey'
  ) THEN
    ALTER TABLE pdf_highlights
    ADD CONSTRAINT pdf_highlights_lancamento_id_fkey
    FOREIGN KEY (lancamento_id)
    REFERENCES verba_lancamentos(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_pdf_highlights_lancamento_id'
  ) THEN
    CREATE INDEX idx_pdf_highlights_lancamento_id ON pdf_highlights(lancamento_id);
  END IF;
END $$;