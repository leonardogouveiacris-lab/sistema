/*
  # Update File Size Limit to 350MB

  1. Changes
    - Update process_documents table CHECK constraint to allow files up to 350MB (367001600 bytes)
    - Update storage bucket file_size_limit from 200MB to 350MB

  2. Details
    - Previous limit: 209715200 bytes (200MB)
    - New limit: 367001600 bytes (350MB)
*/

-- Update the CHECK constraint on process_documents table
ALTER TABLE process_documents
DROP CONSTRAINT IF EXISTS valid_file_size;

ALTER TABLE process_documents
ADD CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 367001600);

-- Update storage bucket file_size_limit
UPDATE storage.buckets
SET file_size_limit = 367001600
WHERE id = 'process-documents';
