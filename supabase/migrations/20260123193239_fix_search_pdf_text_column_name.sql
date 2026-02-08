/*
  # Fix search_pdf_text function column reference

  1. Problem
    - The function was referencing `pd.name` which does not exist
    - The correct columns are `file_name` and `display_name`

  2. Solution
    - Update function to use `COALESCE(pd.display_name, pd.file_name)` as document_name
    - This prefers display_name if set, otherwise falls back to file_name
*/

CREATE OR REPLACE FUNCTION search_pdf_text(
  p_process_id uuid,
  p_query text,
  p_limit integer DEFAULT 50
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
  IF length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  search_pattern := '%' || trim(p_query) || '%';

  RETURN QUERY
  SELECT 
    pd.id AS document_id,
    COALESCE(pd.display_name, pd.file_name) AS document_name,
    pd.sequence_order,
    ptp.page_number,
    trim(p_query) AS match_text,
    CASE 
      WHEN position(lower(trim(p_query)) in lower(ptp.text_content)) > 1 THEN
        substring(
          ptp.text_content 
          FROM greatest(1, position(lower(trim(p_query)) in lower(ptp.text_content)) - 50)
          FOR least(50, position(lower(trim(p_query)) in lower(ptp.text_content)) - 1)
        )
      ELSE ''
    END AS context_before,
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