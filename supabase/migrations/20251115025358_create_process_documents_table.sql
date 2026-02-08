/*
  # Create Process Documents Table

  1. New Tables
    - `process_documents`
      - `id` (uuid, primary key)
      - `process_id` (uuid, foreign key to processes) - UNIQUE constraint for one PDF per process
      - `file_name` (text) - Original filename of the uploaded PDF
      - `file_path` (text) - Path to file in Supabase Storage
      - `file_size` (bigint) - Size of the file in bytes
      - `mime_type` (text) - MIME type (should be 'application/pdf')
      - `created_at` (timestamptz) - Upload timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `process_documents` table
    - Add policy for authenticated users to read their documents
    - Add policy for authenticated users to insert their documents
    - Add policy for authenticated users to update their documents
    - Add policy for authenticated users to delete their documents

  3. Storage
    - Creates storage bucket 'process-documents' for PDF files
    - Sets up public read access for the bucket
    - Configures storage policies for authenticated users

  4. Indexes
    - Index on process_id for fast lookups
    - Unique constraint on process_id to enforce one PDF per process
*/

-- Create the process_documents table
CREATE TABLE IF NOT EXISTS process_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure only one document per process
  CONSTRAINT unique_process_document UNIQUE (process_id),
  
  -- Validate mime type is PDF
  CONSTRAINT valid_mime_type CHECK (mime_type = 'application/pdf'),
  
  -- Validate file size (max 50MB)
  CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 52428800)
);

-- Create index for fast lookups by process_id
CREATE INDEX IF NOT EXISTS idx_process_documents_process_id ON process_documents(process_id);

-- Enable Row Level Security
ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all documents
CREATE POLICY "Users can view process documents"
  ON process_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert documents
CREATE POLICY "Users can upload process documents"
  ON process_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update documents
CREATE POLICY "Users can update process documents"
  ON process_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete documents
CREATE POLICY "Users can delete process documents"
  ON process_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for process documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('process-documents', 'process-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'process-documents');

-- Storage policy: Allow authenticated users to update
CREATE POLICY "Authenticated users can update documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'process-documents')
  WITH CHECK (bucket_id = 'process-documents');

-- Storage policy: Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'process-documents');

-- Storage policy: Public read access
CREATE POLICY "Public read access for documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'process-documents');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_process_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_process_documents_updated_at
  BEFORE UPDATE ON process_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_process_documents_updated_at();
