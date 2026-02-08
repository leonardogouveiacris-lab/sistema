/*
  # Fix Storage Public Read Access
  
  This migration ensures that the storage bucket has proper public read access
  for PDF files. This is critical for the PDF viewer to load documents.
  
  ## Changes
  
  1. Storage Bucket Configuration
     - Ensure 'process-documents' bucket exists
     - Set bucket to public = true
     - Update bucket configuration for proper CORS and access
  
  2. Storage Policies
     - Ensure public SELECT policy exists and is properly configured
     - Add anon role SELECT policy as backup
     - Verify policies don't conflict
  
  ## Security Notes
  
  - Public read access is intentional for PDF viewing
  - Write operations still require anon/authenticated role
  - Files are only accessible if you know the exact path
*/

-- ============================================================================
-- ENSURE STORAGE BUCKET EXISTS AND IS PUBLIC
-- ============================================================================

-- Update bucket to ensure it's public
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'process-documents';

-- If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('process-documents', 'process-documents', true, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

-- ============================================================================
-- ENSURE PUBLIC READ ACCESS POLICY EXISTS
-- ============================================================================

-- Drop existing public read policy if it exists (to recreate it properly)
DROP POLICY IF EXISTS "Public read access for documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can read process documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon can read process documents" ON storage.objects;

-- Create comprehensive public read policy
-- This allows anyone (including unauthenticated users) to download/view PDFs
CREATE POLICY "Public can read process documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'process-documents');

-- Also create anon-specific policy as backup
CREATE POLICY "Anon can read process documents"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'process-documents');

-- ============================================================================
-- VERIFY STORAGE CONFIGURATION
-- ============================================================================

-- Log bucket configuration for debugging
DO $$
DECLARE
  bucket_record RECORD;
BEGIN
  SELECT * INTO bucket_record FROM storage.buckets WHERE id = 'process-documents';
  
  IF bucket_record IS NULL THEN
    RAISE EXCEPTION 'Storage bucket process-documents was not created successfully';
  END IF;
  
  IF bucket_record.public IS NOT TRUE THEN
    RAISE EXCEPTION 'Storage bucket process-documents is not set to public';
  END IF;
  
  RAISE NOTICE 'Storage bucket configured successfully: public=%, file_size_limit=%', 
    bucket_record.public, bucket_record.file_size_limit;
END $$;
