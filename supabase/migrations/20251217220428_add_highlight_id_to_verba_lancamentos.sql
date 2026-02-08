/*
  # Add Highlight Link to Verba Lancamentos

  1. Changes
    - Add `highlight_id` column to `verba_lancamentos` table
      - UUID type, nullable (optional link)
      - Foreign key to `pdf_highlights` table
      - ON DELETE SET NULL (preserve lancamento if highlight is deleted)
    - Add index for performance optimization
    - Add column comment documenting the relationship
  
  2. Purpose
    - Enable automatic linking between verba lancamentos and PDF highlights
    - Support "Fundamentação" feature with bidirectional navigation
    - Maintain data integrity with proper foreign key constraints
*/

-- Add highlight_id column to verba_lancamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'verba_lancamentos' AND column_name = 'highlight_id'
  ) THEN
    ALTER TABLE verba_lancamentos ADD COLUMN highlight_id uuid;
  END IF;
END $$;

-- Add foreign key constraint to pdf_highlights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'verba_lancamentos_highlight_id_fkey'
  ) THEN
    ALTER TABLE verba_lancamentos 
    ADD CONSTRAINT verba_lancamentos_highlight_id_fkey 
    FOREIGN KEY (highlight_id) 
    REFERENCES pdf_highlights(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_verba_lancamentos_highlight_id 
ON verba_lancamentos(highlight_id);

-- Add column comment
COMMENT ON COLUMN verba_lancamentos.highlight_id IS 
'Reference to PDF highlight that represents the fundamentacao (legal basis) for this lancamento. Automatically created when user selects text and clicks Fundamentacao button.';