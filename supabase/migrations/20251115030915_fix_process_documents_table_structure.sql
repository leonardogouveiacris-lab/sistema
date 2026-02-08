/*
  # Fix Process Documents Table Structure
  
  This migration resolves the conflict between two different schemas for process_documents.
  The old schema had a complex versioning system, but the application code expects a simpler
  structure with direct file storage information.
  
  ## Changes
  
  1. Drop Old Tables
     - Drop all tables from the old document management system
     - This includes: document_alerts, version_changes, extraction_references, 
       document_extractions, document_pages, document_versions, process_documents
  
  2. Recreate Simple Schema
     - Create new process_documents table with simple structure
     - Columns: id, process_id, file_name, file_path, file_size, mime_type, created_at, updated_at
     - UNIQUE constraint on process_id (one PDF per process)
  
  3. Security
     - Enable RLS with anon (anonymous) access
     - Allow anon users to SELECT, INSERT, UPDATE, DELETE
  
  ## Note
  
  This will delete any existing documents. If you have important data, back it up first.
*/

-- ============================================================================
-- DROP OLD TABLES (in reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS document_alerts CASCADE;
DROP TABLE IF EXISTS version_changes CASCADE;
DROP TABLE IF EXISTS extraction_references CASCADE;
DROP TABLE IF EXISTS document_extractions CASCADE;
DROP TABLE IF EXISTS document_pages CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS process_documents CASCADE;

-- ============================================================================
-- DROP OLD FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS update_document_page_search_vector() CASCADE;
DROP FUNCTION IF EXISTS update_process_document_timestamp() CASCADE;

-- ============================================================================
-- CREATE NEW SIMPLE PROCESS_DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE process_documents (
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
CREATE INDEX idx_process_documents_process_id ON process_documents(process_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES FOR ANONYMOUS ACCESS
-- ============================================================================

-- Policy: Anonymous users can read all documents
CREATE POLICY "Anonymous users can view process documents"
  ON process_documents
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Anonymous users can insert documents
CREATE POLICY "Anonymous users can upload process documents"
  ON process_documents
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Anonymous users can update documents
CREATE POLICY "Anonymous users can update process documents"
  ON process_documents
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy: Anonymous users can delete documents
CREATE POLICY "Anonymous users can delete process documents"
  ON process_documents
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_process_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_process_documents_updated_at
  BEFORE UPDATE ON process_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_process_documents_updated_at();
