/*
  # Update File Size Limit to 150MB

  1. Changes
    - Update process_documents table CHECK constraint to allow files up to 150MB (157286400 bytes)
    - Update storage bucket file_size_limit from 50MB to 150MB
    - Update storage bucket configuration in storage.buckets table
  
  2. Details
    - Old limit: 52428800 bytes (50MB)
    - New limit: 157286400 bytes (150MB)
    - Applies to: process_documents table constraint and storage bucket configuration
  
  3. Security
    - No changes to RLS policies
    - Maintains existing access control
*/

-- Update the CHECK constraint on process_documents table
ALTER TABLE process_documents 
DROP CONSTRAINT IF EXISTS valid_file_size;

ALTER TABLE process_documents
ADD CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 157286400);

-- Update the storage bucket file size limit
UPDATE storage.buckets
SET file_size_limit = 157286400
WHERE name = 'process-documents';