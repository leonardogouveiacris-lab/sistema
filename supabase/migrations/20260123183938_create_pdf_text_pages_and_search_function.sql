/*
  # Create PDF Text Pages Table and Search Function

  1. New Tables
    - `pdf_text_pages`
      - `id` (uuid, primary key) - unique identifier
      - `process_document_id` (uuid, FK) - reference to process_documents table
      - `page_number` (integer) - page number within the document
      - `text_content` (text) - extracted text content from the page
      - `created_at` (timestamptz) - timestamp of extraction

  2. Indexes
    - Composite index on (process_document_id, page_number) for fast lookups
    - GIN index on text_content for text search performance

  3. Security
    - Enable RLS on pdf_text_pages table
    - Allow anonymous read/write access (matching existing process_documents policy)

  4. Functions
    - `search_pdf_text` - RPC function to search across all PDF pages for a process
*/

-- Create pdf_text_pages table
CREATE TABLE IF NOT EXISTS pdf_text_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_document_id uuid NOT NULL REFERENCES process_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  text_content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(process_document_id, page_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_text_pages_document_page 
  ON pdf_text_pages(process_document_id, page_number);

CREATE INDEX IF NOT EXISTS idx_pdf_text_pages_text_search 
  ON pdf_text_pages USING gin(to_tsvector('portuguese', text_content));

-- Enable RLS
ALTER TABLE pdf_text_pages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (matching process_documents access pattern)
CREATE POLICY "Allow anonymous read access to pdf_text_pages"
  ON pdf_text_pages
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to pdf_text_pages"
  ON pdf_text_pages
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to pdf_text_pages"
  ON pdf_text_pages
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to pdf_text_pages"
  ON pdf_text_pages
  FOR DELETE
  TO anon
  USING (true);

-- Create search function using ILIKE for simple text matching
CREATE OR REPLACE FUNCTION search_pdf_text(
  p_process_id uuid,
  p_query text,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  document_id uuid,
  document_name text,
  sequence_order integer,
  page_number integer,
  match_text text,
  context_before text,
  context_after text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_pattern text;
BEGIN
  -- Return empty if query is too short
  IF length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  search_pattern := '%' || trim(p_query) || '%';

  RETURN QUERY
  SELECT 
    pd.id AS document_id,
    pd.name AS document_name,
    pd.sequence_order,
    ptp.page_number,
    trim(p_query) AS match_text,
    -- Extract context before match (up to 50 chars)
    CASE 
      WHEN position(lower(trim(p_query)) in lower(ptp.text_content)) > 1 THEN
        substring(
          ptp.text_content 
          FROM greatest(1, position(lower(trim(p_query)) in lower(ptp.text_content)) - 50)
          FOR least(50, position(lower(trim(p_query)) in lower(ptp.text_content)) - 1)
        )
      ELSE ''
    END AS context_before,
    -- Extract context after match (up to 50 chars)
    CASE 
      WHEN position(lower(trim(p_query)) in lower(ptp.text_content)) > 0 THEN
        substring(
          ptp.text_content 
          FROM position(lower(trim(p_query)) in lower(ptp.text_content)) + length(trim(p_query))
          FOR 50
        )
      ELSE ''
    END AS context_after
  FROM pdf_text_pages ptp
  INNER JOIN process_documents pd ON pd.id = ptp.process_document_id
  WHERE pd.process_id = p_process_id
    AND ptp.text_content ILIKE search_pattern
  ORDER BY pd.sequence_order, ptp.page_number
  LIMIT p_limit;
END;
$$;