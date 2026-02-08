/*
  # Add Multiple Highlights Support

  1. Changes
    - Add `highlight_ids` column (TEXT[]) to `verba_lancamentos` table
    - Add `highlight_ids` column (TEXT[]) to `lancamentos_documentos` table
    - These arrays store multiple highlight IDs linked to each record
    - Old `highlight_id` column in verba_lancamentos is kept for reference but will be deprecated

  2. Purpose
    - Allow users to link multiple text selections (highlights) to a single verba or documento
    - When navigating to a linked record, all associated highlights will be shown
    
  3. Notes
    - Existing data with single highlight_id will need to be handled in application code
    - New records should use highlight_ids array instead of highlight_id
*/

-- Add highlight_ids array column to verba_lancamentos
ALTER TABLE verba_lancamentos
ADD COLUMN IF NOT EXISTS highlight_ids TEXT[] DEFAULT '{}';

-- Add highlight_ids array column to lancamentos_documentos
ALTER TABLE lancamentos_documentos
ADD COLUMN IF NOT EXISTS highlight_ids TEXT[] DEFAULT '{}';