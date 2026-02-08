/*
  # Add Page Linking to Decisions and Verba Lancamentos

  ## Overview
  This migration adds page linking functionality to allow decisions and verba lancamentos
  to be associated with specific pages in PDF documents. This enables users to:
  - Create records while viewing PDF pages
  - Navigate directly to the page where a record was created
  - See visual markers on PDF pages indicating linked records

  ## Changes

  1. New Columns
    - `decisions.pagina_vinculada` (integer, nullable)
      - Stores the PDF page number where the decision was created/linked
      - Nullable to maintain backward compatibility with existing records
    
    - `verba_lancamentos.pagina_vinculada` (integer, nullable)
      - Stores the PDF page number where the lancamento was created/linked
      - Nullable to maintain backward compatibility with existing records

  2. Indexes
    - Index on `decisions(process_id, pagina_vinculada)` for efficient page-based queries
    - Index on `verba_lancamentos(verba_id, pagina_vinculada)` for efficient page-based queries

  3. Constraints
    - Check constraint to ensure pagina_vinculada is positive when provided
    - No foreign key as page numbers are document-specific metadata

  ## Notes
  - Existing records will have NULL pagina_vinculada (no page linked)
  - Page linking is optional - records can exist without page links
  - Multiple records can be linked to the same page
  - Page numbers should be validated in application layer against document total pages
*/

-- Add pagina_vinculada column to decisions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'pagina_vinculada'
  ) THEN
    ALTER TABLE decisions 
    ADD COLUMN pagina_vinculada integer;
    
    -- Add check constraint to ensure positive page numbers
    ALTER TABLE decisions
    ADD CONSTRAINT decisions_pagina_vinculada_positive 
    CHECK (pagina_vinculada IS NULL OR pagina_vinculada > 0);
  END IF;
END $$;

-- Add pagina_vinculada column to verba_lancamentos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'verba_lancamentos' AND column_name = 'pagina_vinculada'
  ) THEN
    ALTER TABLE verba_lancamentos 
    ADD COLUMN pagina_vinculada integer;
    
    -- Add check constraint to ensure positive page numbers
    ALTER TABLE verba_lancamentos
    ADD CONSTRAINT verba_lancamentos_pagina_vinculada_positive 
    CHECK (pagina_vinculada IS NULL OR pagina_vinculada > 0);
  END IF;
END $$;

-- Create index on decisions for efficient page-based queries
CREATE INDEX IF NOT EXISTS idx_decisions_process_page 
ON decisions(process_id, pagina_vinculada) 
WHERE pagina_vinculada IS NOT NULL;

-- Create index on verba_lancamentos for efficient page-based queries
CREATE INDEX IF NOT EXISTS idx_verba_lancamentos_verba_page 
ON verba_lancamentos(verba_id, pagina_vinculada) 
WHERE pagina_vinculada IS NOT NULL;

-- Add comment to decisions column
COMMENT ON COLUMN decisions.pagina_vinculada IS 
'Page number in the PDF document where this decision is linked. NULL if no page link.';

-- Add comment to verba_lancamentos column
COMMENT ON COLUMN verba_lancamentos.pagina_vinculada IS 
'Page number in the PDF document where this lancamento is linked. NULL if no page link.';