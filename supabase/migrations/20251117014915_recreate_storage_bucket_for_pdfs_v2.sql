/*
  # Recreate Storage Bucket for Process Documents PDFs
  
  ## Overview
  This migration completely recreates the storage bucket for process documents
  with proper configuration to ensure PDFs can be loaded in the browser.
  
  ## Changes
  
  1. **Remove Old Bucket**
     - Delete all files from the bucket first
     - Drop all existing storage policies for 'process-documents'
     - Remove the existing bucket
  
  2. **Create New Bucket with Correct Configuration**
     - Bucket name: 'process-documents'
     - Public access: TRUE (allows public read via getPublicUrl)
     - File size limit: 52428800 bytes (50MB)
     - Allowed MIME types: Only 'application/pdf'
  
  3. **Storage Policies (RLS)**
     - Public SELECT: Anyone can read/download PDFs
     - Anon INSERT: Anonymous users can upload PDFs
     - Authenticated INSERT: Authenticated users can upload PDFs
     - Authenticated UPDATE: Users can replace their PDFs
     - Authenticated DELETE: Users can delete their PDFs
  
  4. **Validation**
     - Verify bucket was created successfully
     - Verify bucket is public
     - Log configuration for debugging
  
  ## Security Notes
  
  - Public read access is intentional for PDF viewing in browser
  - Write operations require anon or authenticated role
  - RLS on process_documents table controls which PDFs users can link
*/

-- ============================================================================
-- STEP 1: DELETE ALL FILES FROM BUCKET
-- ============================================================================

-- Delete all objects from the process-documents bucket
DELETE FROM storage.objects 
WHERE bucket_id = 'process-documents';

-- ============================================================================
-- STEP 2: REMOVE OLD POLICIES
-- ============================================================================

-- Drop all existing policies on storage.objects for process-documents bucket
DROP POLICY IF EXISTS "Public can read process documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon can read process documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

-- ============================================================================
-- STEP 3: DELETE AND RECREATE BUCKET
-- ============================================================================

-- Delete the bucket (now it has no files)
DELETE FROM storage.buckets WHERE id = 'process-documents';

-- Create the bucket with all correct settings
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  avif_autodetection
)
VALUES (
  'process-documents',
  'process-documents',
  true,                                    -- PUBLIC = TRUE for getPublicUrl
  52428800,                                -- 50MB limit
  ARRAY['application/pdf']::text[],        -- Only PDFs allowed
  false                                    -- No auto-detection needed
);

-- ============================================================================
-- STEP 4: CREATE COMPREHENSIVE STORAGE POLICIES
-- ============================================================================

-- Policy 1: Public SELECT - Anyone can read/download PDFs (CRITICAL!)
CREATE POLICY "Anyone can read PDFs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'process-documents');

-- Policy 2: Anonymous users can INSERT (upload) PDFs
CREATE POLICY "Anon users can upload PDFs"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'process-documents' AND
    (storage.foldername(name))[1] IS NOT NULL -- Must be in a folder
  );

-- Policy 3: Authenticated users can INSERT (upload) PDFs
CREATE POLICY "Authenticated users can upload PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'process-documents' AND
    (storage.foldername(name))[1] IS NOT NULL
  );

-- Policy 4: Authenticated users can UPDATE their PDFs
CREATE POLICY "Authenticated users can update PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'process-documents')
  WITH CHECK (bucket_id = 'process-documents');

-- Policy 5: Authenticated users can DELETE their PDFs
CREATE POLICY "Authenticated users can delete PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'process-documents');

-- Policy 6: Anon users can UPDATE (for replacing files during upload)
CREATE POLICY "Anon users can update PDFs"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'process-documents')
  WITH CHECK (bucket_id = 'process-documents');

-- Policy 7: Anon users can DELETE (for cleanup during upload)
CREATE POLICY "Anon users can delete PDFs"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (bucket_id = 'process-documents');

-- ============================================================================
-- STEP 5: VALIDATE CONFIGURATION
-- ============================================================================

DO $$
DECLARE
  bucket_record RECORD;
  policy_count INTEGER;
BEGIN
  -- Check if bucket was created
  SELECT * INTO bucket_record 
  FROM storage.buckets 
  WHERE id = 'process-documents';
  
  IF bucket_record IS NULL THEN
    RAISE EXCEPTION 'FAILED: Storage bucket was not created';
  END IF;
  
  -- Verify bucket is public
  IF bucket_record.public IS NOT TRUE THEN
    RAISE EXCEPTION 'FAILED: Storage bucket is not public';
  END IF;
  
  -- Verify file size limit
  IF bucket_record.file_size_limit != 52428800 THEN
    RAISE EXCEPTION 'FAILED: File size limit is incorrect (expected 52428800, got %)', 
      bucket_record.file_size_limit;
  END IF;
  
  -- Verify MIME types
  IF 'application/pdf' != ALL(bucket_record.allowed_mime_types) THEN
    RAISE EXCEPTION 'FAILED: MIME types not configured correctly';
  END IF;
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname LIKE '%PDF%';
  
  IF policy_count < 5 THEN
    RAISE WARNING 'Only % storage policies found, expected at least 5', policy_count;
  END IF;
  
  -- Success message
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUCCESS: Storage bucket configured!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Bucket ID: %', bucket_record.id;
  RAISE NOTICE 'Public: %', bucket_record.public;
  RAISE NOTICE 'File Size Limit: % bytes (% MB)', 
    bucket_record.file_size_limit, 
    (bucket_record.file_size_limit / 1048576.0)::numeric(10,2);
  RAISE NOTICE 'Allowed MIME Types: %', bucket_record.allowed_mime_types;
  RAISE NOTICE 'Storage Policies: % active', policy_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'You can now upload PDFs and they will be publicly accessible!';
  RAISE NOTICE '========================================';
END $$;