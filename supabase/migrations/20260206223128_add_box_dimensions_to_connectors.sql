/*
  # Add box dimensions to connectors

  1. New Columns
    - `box_width` (numeric) - Width of highlight box in PDF units
    - `box_height` (numeric) - Height of highlight box in PDF units

  2. Notes
    - These columns are used for the resizable highlight box feature
    - Only applicable when connector_type = 'highlightbox'
*/

ALTER TABLE pdf_comment_connectors 
ADD COLUMN IF NOT EXISTS box_width numeric;

ALTER TABLE pdf_comment_connectors 
ADD COLUMN IF NOT EXISTS box_height numeric;
