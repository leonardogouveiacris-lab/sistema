/*
  # Fix Storage Policies for Anonymous Access
  
  This migration updates the storage policies for the 'process-documents' bucket
  to allow anonymous users to upload, update, and delete documents.
  
  ## Changes
  
  1. Storage Policies
     - DROP existing authenticated-only policies
     - CREATE new policies for anonymous (anon) role
     - Keep public read access policy
     - Allow anon role to INSERT, UPDATE, and DELETE in process-documents bucket
  
  2. Table Policies
     - Update process_documents table policies to allow anon access
     - Change from 'authenticated' to 'anon' role
  
  ## Security Notes
  
  - This allows any user (even unauthenticated) to upload PDFs
  - In production, you may want to add rate limiting
  - Consider adding authentication in the future for better security
*/

-- ============================================================================
-- DROP EXISTING STORAGE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- ============================================================================
-- CREATE NEW STORAGE POLICIES FOR ANONYMOUS ACCESS
-- ============================================================================

-- Policy: Allow anonymous users to upload documents
CREATE POLICY "Anonymous users can upload documents"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'process-documents');

-- Policy: Allow anonymous users to update documents
CREATE POLICY "Anonymous users can update documents"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'process-documents')
  WITH CHECK (bucket_id = 'process-documents');

-- Policy: Allow anonymous users to delete documents
CREATE POLICY "Anonymous users can delete documents"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (bucket_id = 'process-documents');

-- ============================================================================
-- UPDATE TABLE POLICIES FOR ANONYMOUS ACCESS
-- ============================================================================

-- Drop existing policies on process_documents table
DROP POLICY IF EXISTS "Users can view process documents" ON process_documents;
DROP POLICY IF EXISTS "Users can upload process documents" ON process_documents;
DROP POLICY IF EXISTS "Users can update process documents" ON process_documents;
DROP POLICY IF EXISTS "Users can delete process documents" ON process_documents;

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
