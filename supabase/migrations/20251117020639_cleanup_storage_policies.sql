/*
  # Cleanup and Consolidation of Storage Bucket Policies

  ## Overview
  This migration removes all redundant storage policies for the 'process-documents'
  bucket and establishes a clean, minimal set of 4 essential policies.

  ## Problem Being Solved
  Over time, multiple migrations created overlapping and duplicate policies:
  - 10 policies existed when only 4 are needed
  - Multiple policies with similar names doing the same thing
  - Confusion between "Anonymous", "Anon", "Public", etc.
  - Authenticated user policies that are never used

  ## Changes

  1. **Remove ALL Existing Policies**
     - Drop all 10+ existing policies on storage.objects
     - Clean slate approach to prevent conflicts
  
  2. **Create 4 Essential Policies**
     - Public READ: Anyone can view PDFs (critical for browser viewing)
     - Anon INSERT: Anonymous users can upload PDFs
     - Anon UPDATE: Anonymous users can replace PDFs
     - Anon DELETE: Anonymous users can remove PDFs

  3. **Policy Naming Convention**
     - Clear, descriptive names
     - Consistent format: "[Role] can [action] PDFs"
     - No ambiguous terms

  ## Security Model

  - **Public Read Access**: Required for PDF viewer to load documents in browser
  - **Anonymous Write Access**: Application uses anon key, not authentication
  - **No Authenticated Policies**: Not needed since app doesn't use auth
  - **Application-Level Security**: Real security is in process_documents table RLS

  ## Technical Notes

  - Bucket remains public (public = true) for getPublicUrl() to work
  - File size limit: 50MB (52428800 bytes)
  - Only PDF MIME type allowed: application/pdf
  - Policies use 'anon' role which maps to SUPABASE_ANON_KEY
*/

-- ============================================================================
-- STEP 1: REMOVE ALL EXISTING STORAGE POLICIES
-- ============================================================================

-- This list includes all known policy names from previous migrations
DROP POLICY IF EXISTS "Public can read process documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon can read process documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read PDFs" ON storage.objects;

DROP POLICY IF EXISTS "Anon users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can upload PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload PDFs" ON storage.objects;

DROP POLICY IF EXISTS "Anon users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can update PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update PDFs" ON storage.objects;

DROP POLICY IF EXISTS "Anon users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can delete PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete PDFs" ON storage.objects;

DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

-- ============================================================================
-- STEP 2: VERIFY BUCKET CONFIGURATION
-- ============================================================================

-- Ensure bucket exists and is properly configured
DO $$
DECLARE
  bucket_record RECORD;
BEGIN
  SELECT * INTO bucket_record 
  FROM storage.buckets 
  WHERE id = 'process-documents';
  
  IF bucket_record IS NULL THEN
    RAISE EXCEPTION 'Storage bucket process-documents does not exist. Run previous migrations first.';
  END IF;
  
  IF bucket_record.public IS NOT TRUE THEN
    -- Fix bucket to be public
    UPDATE storage.buckets 
    SET public = true 
    WHERE id = 'process-documents';
    
    RAISE NOTICE 'Fixed: Bucket was not public, setting public = true';
  END IF;
  
  RAISE NOTICE 'Bucket configuration verified: public=%, file_size_limit=% bytes', 
    bucket_record.public, bucket_record.file_size_limit;
END $$;

-- ============================================================================
-- STEP 3: CREATE CLEAN, MINIMAL SET OF POLICIES
-- ============================================================================

-- POLICY 1: Public SELECT (READ)
-- Purpose: Allow anyone (including unauthenticated browsers) to view/download PDFs
-- This is CRITICAL for the PDF viewer component to function
CREATE POLICY "Public can read PDFs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'process-documents');

-- POLICY 2: Anonymous INSERT (UPLOAD)
-- Purpose: Allow file uploads using the SUPABASE_ANON_KEY
-- Requires files to be organized in folders (validated by foldername check)
CREATE POLICY "Anon can upload PDFs"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'process-documents' AND
    (storage.foldername(name))[1] IS NOT NULL
  );

-- POLICY 3: Anonymous UPDATE (REPLACE)
-- Purpose: Allow replacing existing files (needed during re-upload)
-- Uses both USING (read check) and WITH CHECK (write check)
CREATE POLICY "Anon can update PDFs"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'process-documents')
  WITH CHECK (bucket_id = 'process-documents');

-- POLICY 4: Anonymous DELETE (REMOVE)
-- Purpose: Allow file deletion when removing documents from processes
CREATE POLICY "Anon can delete PDFs"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (bucket_id = 'process-documents');

-- ============================================================================
-- STEP 4: VALIDATION AND SUMMARY
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
  policy_names TEXT;
BEGIN
  -- Count policies for this bucket
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND (
      policyname LIKE '%PDF%' OR 
      policyname LIKE '%process%document%'
    );
  
  -- Get policy names
  SELECT string_agg(policyname, ', ') INTO policy_names
  FROM pg_policies
  WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND (
      policyname LIKE '%PDF%' OR 
      policyname LIKE '%process%document%'
    );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STORAGE POLICIES CLEANUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total policies: %', policy_count;
  RAISE NOTICE 'Policy names: %', policy_names;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Expected: 4 policies (Public read, Anon upload, Anon update, Anon delete)';
  
  IF policy_count != 4 THEN
    RAISE WARNING 'Unexpected policy count! Expected 4, found %', policy_count;
  ELSE
    RAISE NOTICE 'SUCCESS: Correct number of policies configured';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
