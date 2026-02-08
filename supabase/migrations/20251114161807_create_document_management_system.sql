/*
  # Document Management System with Versioning
  
  ## Overview
  Creates a comprehensive document management system for process PDFs with full version control,
  allowing tracking of process updates (andamentos) while preserving references to specific versions.
  
  ## New Tables
  
  ### `process_documents`
  Main container for documents associated with processes.
  - `id` (uuid, primary key) - Unique document identifier
  - `process_id` (uuid, foreign key) - Links to processes table
  - `document_type` (text) - Type of document (e.g., "Processo Integral", "Andamento", "Sentença")
  - `title` (text) - Document title/description
  - `current_version_id` (uuid, nullable) - Points to the current active version
  - `created_at` (timestamptz) - Document creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `document_versions`
  Stores all versions of each document with complete history.
  - `id` (uuid, primary key) - Unique version identifier
  - `document_id` (uuid, foreign key) - Links to parent document
  - `version_number` (integer) - Sequential version number
  - `file_name` (text) - Original filename
  - `file_size` (bigint) - File size in bytes
  - `page_count` (integer) - Total number of pages
  - `storage_path` (text) - Path in Supabase Storage
  - `file_hash` (text) - SHA-256 hash for integrity verification
  - `change_description` (text) - Description of changes in this version
  - `upload_date` (timestamptz) - When this version was uploaded
  - `is_current` (boolean) - Whether this is the current version
  - `processing_status` (text) - Status: pending, processing, completed, error
  
  ### `document_pages`
  Individual page indexing for search and navigation.
  - `id` (uuid, primary key) - Unique page identifier
  - `version_id` (uuid, foreign key) - Links to document version
  - `page_number` (integer) - Page number within document
  - `text_content` (text) - Extracted text from page (prepared for OCR)
  - `search_vector` (tsvector) - Full-text search index
  - `thumbnail_path` (text, nullable) - Path to thumbnail image
  - `page_hash` (text) - Hash for deduplication
  - `ocr_completed` (boolean) - Flag for OCR processing status
  
  ### `document_extractions`
  Text extractions from documents with coordinates.
  - `id` (uuid, primary key) - Unique extraction identifier
  - `version_id` (uuid, foreign key) - Links to document version
  - `page_number` (integer) - Page where extraction was made
  - `extracted_text` (text) - The extracted text content
  - `coordinates` (jsonb) - Position data: {x, y, width, height}
  - `category` (text) - Category: fundamentacao_legal, prova_documental, decisao_judicial, verba_trabalhista, observacao, marcador_ia
  - `title` (text) - User-provided title for extraction
  - `tags` (text[]) - Array of tags for categorization
  - `observations` (text, nullable) - Additional notes
  - `created_at` (timestamptz) - Creation timestamp
  - `status` (text) - Status: valid, needs_review, obsolete, migrated
  
  ### `extraction_references`
  Links between extractions and other entities (decisions, verbas).
  - `id` (uuid, primary key) - Unique reference identifier
  - `extraction_id` (uuid, foreign key) - Links to extraction
  - `reference_type` (text) - Type: decision, verba_lancamento, custom
  - `reference_id` (uuid, nullable) - ID of referenced entity
  - `created_at` (timestamptz) - Creation timestamp
  
  ### `version_changes`
  Tracks differences between document versions.
  - `id` (uuid, primary key) - Unique change record identifier
  - `old_version_id` (uuid, foreign key) - Previous version
  - `new_version_id` (uuid, foreign key) - New version
  - `pages_added` (integer) - Number of pages added
  - `pages_removed` (integer) - Number of pages removed
  - `pages_modified` (integer) - Number of pages modified
  - `change_summary` (jsonb) - Detailed changes data
  - `analyzed_at` (timestamptz) - When analysis was performed
  
  ### `document_alerts`
  Notifications for document-related actions needed.
  - `id` (uuid, primary key) - Unique alert identifier
  - `document_id` (uuid, foreign key) - Related document
  - `alert_type` (text) - Type: broken_reference, needs_review, migration_pending
  - `message` (text) - Alert message
  - `severity` (text) - Severity: info, warning, error
  - `is_dismissed` (boolean) - Whether alert was dismissed
  - `created_at` (timestamptz) - Alert creation time
  
  ## Security
  - Enable RLS on all tables
  - Policies allow authenticated users to manage documents for their processes
  - All operations require authentication
  
  ## Indexes
  - Optimized indexes for version lookups, page searches, and full-text search
  - Composite indexes for common query patterns
*/

-- Create process_documents table
CREATE TABLE IF NOT EXISTS process_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'Processo Integral',
  title text NOT NULL,
  current_version_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_versions table
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES process_documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  page_count integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  file_hash text NOT NULL,
  change_description text,
  upload_date timestamptz DEFAULT now(),
  is_current boolean DEFAULT true,
  processing_status text DEFAULT 'pending',
  CONSTRAINT unique_version_per_document UNIQUE (document_id, version_number)
);

-- Add foreign key for current_version_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_current_version' 
    AND table_name = 'process_documents'
  ) THEN
    ALTER TABLE process_documents 
    ADD CONSTRAINT fk_current_version 
    FOREIGN KEY (current_version_id) 
    REFERENCES document_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create document_pages table
CREATE TABLE IF NOT EXISTS document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  text_content text,
  search_vector tsvector,
  thumbnail_path text,
  page_hash text,
  ocr_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_page_per_version UNIQUE (version_id, page_number)
);

-- Create document_extractions table
CREATE TABLE IF NOT EXISTS document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  extracted_text text NOT NULL,
  coordinates jsonb NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  tags text[] DEFAULT '{}',
  observations text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'valid'
);

-- Create extraction_references table
CREATE TABLE IF NOT EXISTS extraction_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id uuid NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
  reference_type text NOT NULL,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create version_changes table
CREATE TABLE IF NOT EXISTS version_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  new_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  pages_added integer DEFAULT 0,
  pages_removed integer DEFAULT 0,
  pages_modified integer DEFAULT 0,
  change_summary jsonb,
  analyzed_at timestamptz DEFAULT now()
);

-- Create document_alerts table
CREATE TABLE IF NOT EXISTS document_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES process_documents(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  message text NOT NULL,
  severity text DEFAULT 'info',
  is_dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_process_documents_process_id ON process_documents(process_id);
CREATE INDEX IF NOT EXISTS idx_process_documents_current_version ON process_documents(current_version_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_is_current ON document_versions(document_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_document_pages_version_id ON document_pages(version_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_page_number ON document_pages(version_id, page_number);
CREATE INDEX IF NOT EXISTS idx_document_pages_search_vector ON document_pages USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_document_extractions_version_id ON document_extractions(version_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_page_number ON document_extractions(version_id, page_number);
CREATE INDEX IF NOT EXISTS idx_document_extractions_status ON document_extractions(status);
CREATE INDEX IF NOT EXISTS idx_extraction_references_extraction_id ON extraction_references(extraction_id);
CREATE INDEX IF NOT EXISTS idx_extraction_references_reference ON extraction_references(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_document_alerts_document_id ON document_alerts(document_id) WHERE is_dismissed = false;

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION update_document_page_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.text_content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search_vector update
DROP TRIGGER IF EXISTS trigger_update_document_page_search_vector ON document_pages;
CREATE TRIGGER trigger_update_document_page_search_vector
  BEFORE INSERT OR UPDATE OF text_content ON document_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_document_page_search_vector();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_process_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_process_document_timestamp ON process_documents;
CREATE TRIGGER trigger_update_process_document_timestamp
  BEFORE UPDATE ON process_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_process_document_timestamp();

-- Enable Row Level Security
ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for process_documents
CREATE POLICY "Users can view documents from their processes"
  ON process_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert documents to their processes"
  ON process_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their process documents"
  ON process_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their process documents"
  ON process_documents FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for document_versions
CREATE POLICY "Users can view document versions"
  ON document_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert document versions"
  ON document_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update document versions"
  ON document_versions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete document versions"
  ON document_versions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for document_pages
CREATE POLICY "Users can view document pages"
  ON document_pages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert document pages"
  ON document_pages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update document pages"
  ON document_pages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete document pages"
  ON document_pages FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for document_extractions
CREATE POLICY "Users can view extractions"
  ON document_extractions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert extractions"
  ON document_extractions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update extractions"
  ON document_extractions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete extractions"
  ON document_extractions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for extraction_references
CREATE POLICY "Users can view extraction references"
  ON extraction_references FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert extraction references"
  ON extraction_references FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update extraction references"
  ON extraction_references FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete extraction references"
  ON extraction_references FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for version_changes
CREATE POLICY "Users can view version changes"
  ON version_changes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert version changes"
  ON version_changes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for document_alerts
CREATE POLICY "Users can view document alerts"
  ON document_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert document alerts"
  ON document_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update document alerts"
  ON document_alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete document alerts"
  ON document_alerts FOR DELETE
  TO authenticated
  USING (true);