/*
  # Update connector type constraint

  1. Changes
    - Drop existing `valid_connector_type` check constraint
    - Add new constraint allowing 'arrow' and 'highlightbox' (replacing 'textbox')

  2. Notes
    - This change supports the new highlight box feature for marking areas on PDFs
*/

ALTER TABLE pdf_comment_connectors 
DROP CONSTRAINT IF EXISTS valid_connector_type;

ALTER TABLE pdf_comment_connectors 
ADD CONSTRAINT valid_connector_type 
CHECK (connector_type IN ('arrow', 'highlightbox'));

-- Update any existing 'textbox' connectors to 'highlightbox'
UPDATE pdf_comment_connectors 
SET connector_type = 'highlightbox' 
WHERE connector_type = 'textbox';
