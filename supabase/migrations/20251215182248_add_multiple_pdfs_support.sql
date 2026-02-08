/*
  # Add Multiple PDFs Support per Process

  1. Changes to `process_documents` table
    - Remove UNIQUE constraint on process_id (allow multiple PDFs per process)
    - Add `sequence_order` (integer) - Order of PDF in sequence
    - Add `date_reference` (date, optional) - Cut-off date for this PDF
    - Add `display_name` (text) - Auto-generated name for the PDF
    - Add UNIQUE constraint on (process_id, sequence_order)

  2. Link Documents to Launches
    - Add `process_document_id` to `decisions` table (nullable, FK with CASCADE)
    - Add `process_document_id` to `verba_lancamentos` table (nullable, FK with CASCADE)
    - Add `process_document_id` to `lancamentos_documentos` table (nullable, FK with CASCADE)

  3. Helper Functions
    - Function to generate display_name automatically
    - Trigger to set display_name on insert/update

  4. Data Migration
    - Existing PDFs get sequence_order = 1 and display_name = "Integra Principal"
    - Existing launches remain with process_document_id = NULL (backwards compatible)

  5. Indexes
    - Create indexes on new foreign keys for performance
*/

-- Step 1: Remove old UNIQUE constraint and add new fields to process_documents
DO $$
BEGIN
  -- Remove old unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_process_document'
  ) THEN
    ALTER TABLE process_documents DROP CONSTRAINT unique_process_document;
  END IF;
END $$;

-- Add new columns to process_documents
ALTER TABLE process_documents
  ADD COLUMN IF NOT EXISTS sequence_order integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS date_reference date,
  ADD COLUMN IF NOT EXISTS display_name text;

-- Add new UNIQUE constraint on (process_id, sequence_order)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_process_document_sequence'
  ) THEN
    ALTER TABLE process_documents
      ADD CONSTRAINT unique_process_document_sequence
      UNIQUE (process_id, sequence_order);
  END IF;
END $$;

-- Add constraint to ensure sequence_order is positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'process_documents_sequence_positive'
  ) THEN
    ALTER TABLE process_documents
      ADD CONSTRAINT process_documents_sequence_positive
      CHECK (sequence_order > 0);
  END IF;
END $$;

-- Add constraint for display_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'process_documents_display_name_not_empty'
  ) THEN
    ALTER TABLE process_documents
      ADD CONSTRAINT process_documents_display_name_not_empty
      CHECK (length(TRIM(BOTH FROM display_name)) > 0);
  END IF;
END $$;

-- Create index on (process_id, sequence_order) for fast lookups
CREATE INDEX IF NOT EXISTS idx_process_documents_process_sequence
  ON process_documents(process_id, sequence_order);

-- Step 2: Add process_document_id to launches tables

-- Add to decisions table
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS process_document_id uuid REFERENCES process_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_decisions_process_document_id
  ON decisions(process_document_id);

-- Add to verba_lancamentos table
ALTER TABLE verba_lancamentos
  ADD COLUMN IF NOT EXISTS process_document_id uuid REFERENCES process_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_verba_lancamentos_process_document_id
  ON verba_lancamentos(process_document_id);

-- Add to lancamentos_documentos table
ALTER TABLE lancamentos_documentos
  ADD COLUMN IF NOT EXISTS process_document_id uuid REFERENCES process_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lancamentos_documentos_process_document_id
  ON lancamentos_documentos(process_document_id);

-- Step 3: Create function to generate display_name automatically
CREATE OR REPLACE FUNCTION generate_document_display_name(
  p_sequence_order integer,
  p_date_reference date DEFAULT NULL
)
RETURNS text AS $$
DECLARE
  v_name text;
BEGIN
  -- First document is "Integra Principal"
  IF p_sequence_order = 1 THEN
    v_name := 'Integra Principal';
  ELSE
    -- Subsequent documents are "Atualização N"
    v_name := 'Atualização ' || (p_sequence_order - 1)::text;
  END IF;

  -- Append date if provided
  IF p_date_reference IS NOT NULL THEN
    v_name := v_name || ' (' || to_char(p_date_reference, 'DD/MM/YYYY') || ')';
  END IF;

  RETURN v_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create trigger to auto-generate display_name
CREATE OR REPLACE FUNCTION set_process_document_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set display_name if not provided or if sequence_order/date_reference changed
  IF NEW.display_name IS NULL OR
     (TG_OP = 'UPDATE' AND (
       OLD.sequence_order IS DISTINCT FROM NEW.sequence_order OR
       OLD.date_reference IS DISTINCT FROM NEW.date_reference
     ))
  THEN
    NEW.display_name := generate_document_display_name(
      NEW.sequence_order,
      NEW.date_reference
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_set_process_document_display_name ON process_documents;

CREATE TRIGGER trigger_set_process_document_display_name
  BEFORE INSERT OR UPDATE ON process_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_process_document_display_name();

-- Step 5: Migrate existing data
-- Update existing documents to have display_name
UPDATE process_documents
SET display_name = generate_document_display_name(sequence_order, date_reference)
WHERE display_name IS NULL;

-- Step 6: Add comments for documentation
COMMENT ON COLUMN process_documents.sequence_order IS 'Order of PDF in the process sequence (1, 2, 3, ...)';
COMMENT ON COLUMN process_documents.date_reference IS 'Optional reference date indicating when this PDF was current';
COMMENT ON COLUMN process_documents.display_name IS 'Auto-generated display name (e.g., "Integra Principal", "Atualização 1")';
COMMENT ON COLUMN decisions.process_document_id IS 'Links decision to specific PDF where it was recorded';
COMMENT ON COLUMN verba_lancamentos.process_document_id IS 'Links verba launch to specific PDF where it was recorded';
COMMENT ON COLUMN lancamentos_documentos.process_document_id IS 'Links documento to specific PDF where it was recorded';

-- Create helper function to get next sequence order for a process
CREATE OR REPLACE FUNCTION get_next_sequence_order(p_process_id uuid)
RETURNS integer AS $$
DECLARE
  v_max_order integer;
BEGIN
  SELECT COALESCE(MAX(sequence_order), 0) + 1
  INTO v_max_order
  FROM process_documents
  WHERE process_id = p_process_id;

  RETURN v_max_order;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to reorder documents after deletion
CREATE OR REPLACE FUNCTION reorder_process_documents_after_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Update sequence_order for all documents after the deleted one
  UPDATE process_documents
  SET sequence_order = sequence_order - 1
  WHERE process_id = OLD.process_id
    AND sequence_order > OLD.sequence_order;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic reordering
DROP TRIGGER IF EXISTS trigger_reorder_after_delete ON process_documents;

CREATE TRIGGER trigger_reorder_after_delete
  AFTER DELETE ON process_documents
  FOR EACH ROW
  EXECUTE FUNCTION reorder_process_documents_after_delete();

-- Create function to get document statistics (linked launches)
CREATE OR REPLACE FUNCTION get_document_statistics(p_document_id uuid)
RETURNS TABLE(
  decisions_count bigint,
  verbas_count bigint,
  documentos_count bigint,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM decisions WHERE process_document_id = p_document_id),
    (SELECT COUNT(*) FROM verba_lancamentos WHERE process_document_id = p_document_id),
    (SELECT COUNT(*) FROM lancamentos_documentos WHERE process_document_id = p_document_id),
    (SELECT COUNT(*) FROM decisions WHERE process_document_id = p_document_id) +
    (SELECT COUNT(*) FROM verba_lancamentos WHERE process_document_id = p_document_id) +
    (SELECT COUNT(*) FROM lancamentos_documentos WHERE process_document_id = p_document_id);
END;
$$ LANGUAGE plpgsql;
