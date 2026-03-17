/*
  # Add checklist fields to lancamentos_documentos table

  ## Summary
  Adds calculista/revisor checklist fields to the lancamentos_documentos table,
  mirroring the existing checklist system used by verba_lancamentos. This enables
  the same "lock on completion" behavior for document lancamentos.

  ## New Columns
  - `check_calculista` (boolean, default false) - Whether the calculista has verified this document
  - `check_calculista_at` (timestamptz, nullable) - When the calculista check was made
  - `check_revisor` (boolean, default false) - Whether the revisor has approved this document
  - `check_revisor_at` (timestamptz, nullable) - When the revisor check was made

  ## Notes
  - All new columns default to false/null so existing records are unaffected
  - No RLS changes needed as the table already has proper policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos_documentos' AND column_name = 'check_calculista'
  ) THEN
    ALTER TABLE lancamentos_documentos ADD COLUMN check_calculista boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos_documentos' AND column_name = 'check_calculista_at'
  ) THEN
    ALTER TABLE lancamentos_documentos ADD COLUMN check_calculista_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos_documentos' AND column_name = 'check_revisor'
  ) THEN
    ALTER TABLE lancamentos_documentos ADD COLUMN check_revisor boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos_documentos' AND column_name = 'check_revisor_at'
  ) THEN
    ALTER TABLE lancamentos_documentos ADD COLUMN check_revisor_at timestamptz;
  END IF;
END $$;
