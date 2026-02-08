/*
  # Create PDF Page Rotations Table

  1. New Tables
    - `pdf_page_rotations`
      - `id` (uuid, primary key)
      - `process_document_id` (uuid, foreign key to process_documents)
      - `page_number` (integer, the page number being rotated)
      - `rotation_degrees` (integer, rotation in degrees: 0, 90, 180, 270)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Constraints
    - Unique constraint on (process_document_id, page_number) to prevent duplicate entries
    - Check constraint to ensure rotation_degrees is valid (0, 90, 180, 270)
    - Check constraint to ensure page_number is positive

  3. Security
    - Enable RLS on `pdf_page_rotations` table
    - Add policies for anonymous access (matching existing pattern)

  4. Indexes
    - Index on process_document_id for faster lookups
*/

CREATE TABLE IF NOT EXISTS pdf_page_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_document_id uuid NOT NULL REFERENCES process_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  rotation_degrees integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT pdf_page_rotations_page_positive CHECK (page_number > 0),
  CONSTRAINT pdf_page_rotations_valid_degrees CHECK (rotation_degrees IN (0, 90, 180, 270)),
  CONSTRAINT pdf_page_rotations_unique_page UNIQUE (process_document_id, page_number)
);

COMMENT ON TABLE pdf_page_rotations IS 'Stores page rotation settings for PDF documents. Each entry represents the rotation of a specific page in a document.';
COMMENT ON COLUMN pdf_page_rotations.process_document_id IS 'Reference to the PDF document this rotation belongs to';
COMMENT ON COLUMN pdf_page_rotations.page_number IS 'The page number (1-indexed) that is rotated';
COMMENT ON COLUMN pdf_page_rotations.rotation_degrees IS 'Rotation in degrees clockwise (0, 90, 180, 270)';

CREATE INDEX IF NOT EXISTS idx_pdf_page_rotations_document 
  ON pdf_page_rotations(process_document_id);

ALTER TABLE pdf_page_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select on pdf_page_rotations"
  ON pdf_page_rotations
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert on pdf_page_rotations"
  ON pdf_page_rotations
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on pdf_page_rotations"
  ON pdf_page_rotations
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on pdf_page_rotations"
  ON pdf_page_rotations
  FOR DELETE
  TO anon
  USING (true);
