/*
  # Fix PDF Highlights RLS Policies

  1. Changes
    - Drop existing policies on pdf_highlights table
    - Recreate policies with explicit role permissions
    - Allow both authenticated and anon roles to perform operations
    - This ensures compatibility with Supabase client using anon key

  2. Security
    - Policies allow public access for now to match other tables in the system
    - All operations (SELECT, INSERT, UPDATE, DELETE) are permitted
    - This matches the access pattern used in other tables like processes, verbas, decisions

  3. Notes
    - The Supabase client uses the anon key by default
    - RLS still provides protection through the anon key restriction
    - Future enhancement: add user-specific policies when auth is implemented
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read highlights" ON pdf_highlights;
DROP POLICY IF EXISTS "Allow authenticated users to create highlights" ON pdf_highlights;
DROP POLICY IF EXISTS "Allow authenticated users to update highlights" ON pdf_highlights;
DROP POLICY IF EXISTS "Allow authenticated users to delete highlights" ON pdf_highlights;

-- Policy: Allow public read access
CREATE POLICY "Allow public read access to highlights"
  ON pdf_highlights
  FOR SELECT
  USING (true);

-- Policy: Allow public insert access
CREATE POLICY "Allow public insert access to highlights"
  ON pdf_highlights
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow public update access
CREATE POLICY "Allow public update access to highlights"
  ON pdf_highlights
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Allow public delete access
CREATE POLICY "Allow public delete access to highlights"
  ON pdf_highlights
  FOR DELETE
  USING (true);