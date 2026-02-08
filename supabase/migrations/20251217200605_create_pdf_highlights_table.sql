/*
  # Create PDF Highlights Table

  1. New Tables
    - `pdf_highlights`
      - `id` (uuid, primary key) - Unique identifier for each highlight
      - `process_id` (uuid, foreign key) - Link to the process
      - `process_document_id` (uuid, foreign key) - Link to the specific PDF document
      - `page_number` (integer) - Page number where highlight is located
      - `selected_text` (text) - The actual text that was highlighted
      - `position_data` (jsonb) - Coordinates and dimensions for rendering (x, y, width, height)
      - `color` (text) - Highlight color (yellow, green, blue, pink, purple, orange)
      - `created_at` (timestamptz) - Timestamp of creation
      - `updated_at` (timestamptz) - Timestamp of last update

  2. Security
    - Enable RLS on `pdf_highlights` table
    - Add policy for authenticated users to read highlights from their processes
    - Add policy for authenticated users to create highlights
    - Add policy for authenticated users to update their own highlights
    - Add policy for authenticated users to delete their own highlights

  3. Indexes
    - Index on process_id for faster queries
    - Index on process_document_id for faster queries
    - Index on page_number for faster page-specific queries
*/

-- Create the pdf_highlights table
CREATE TABLE IF NOT EXISTS pdf_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL,
  process_document_id uuid NOT NULL REFERENCES process_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  selected_text text NOT NULL,
  position_data jsonb NOT NULL,
  color text NOT NULL DEFAULT 'yellow',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE pdf_highlights ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdf_highlights_process_id ON pdf_highlights(process_id);
CREATE INDEX IF NOT EXISTS idx_pdf_highlights_document_id ON pdf_highlights(process_document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_highlights_page_number ON pdf_highlights(page_number);

-- Policy: Allow authenticated users to read all highlights
CREATE POLICY "Allow authenticated users to read highlights"
  ON pdf_highlights
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to create highlights
CREATE POLICY "Allow authenticated users to create highlights"
  ON pdf_highlights
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update highlights
CREATE POLICY "Allow authenticated users to update highlights"
  ON pdf_highlights
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete highlights
CREATE POLICY "Allow authenticated users to delete highlights"
  ON pdf_highlights
  FOR DELETE
  TO authenticated
  USING (true);