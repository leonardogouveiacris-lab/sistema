/*
  # Add coordinate version to PDF highlights

  1. Changes
    - Add `coordinate_version` column to `pdf_highlights` table
    - Version 1: Coordinates were normalized (divided by zoom) - legacy format
    - Version 2: Coordinates are in page pixels (new format)
    - Existing highlights are marked as version 1
    - New highlights will default to version 2

  2. Notes
    - This migration maintains backward compatibility with existing highlights
    - The HighlightLayer component will handle both versions appropriately
*/

ALTER TABLE pdf_highlights 
ADD COLUMN IF NOT EXISTS coordinate_version integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN pdf_highlights.coordinate_version IS 
'Version of coordinate format: 1 = normalized (divided by zoom), 2 = page pixels';

UPDATE pdf_highlights 
SET coordinate_version = 1 
WHERE coordinate_version = 2;