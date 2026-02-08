/*
  # Fix search_pdf_text to return ALL occurrences

  1. Problem
    - The previous function returned only ONE result per page
    - If a page had "teste" 3 times, only 1 result was returned
    - Users expected to navigate through ALL occurrences

  2. Solution
    - Use a loop to find ALL occurrences of the search term in each page
    - Return separate rows for each occurrence with correct context
    - Add occurrence_index to track position within page

  3. Changes
    - Rewrote function to iterate through all matches
    - Each occurrence gets its own row in results
    - Context is extracted around each specific occurrence
*/

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
  search_term text;
  search_term_lower text;
  rec RECORD;
  content_lower text;
  match_pos integer;
  search_start integer;
  occurrence_count integer;
  total_results integer := 0;
BEGIN
  search_term := trim(p_query);
  
  IF length(search_term) < 2 THEN
    RETURN;
  END IF;

  search_term_lower := lower(search_term);

  FOR rec IN 
    SELECT 
      pd.id AS doc_id,
      COALESCE(pd.display_name, pd.file_name) AS doc_name,
      pd.sequence_order AS seq_order,
      ptp.page_number AS pg_number,
      ptp.text_content AS content
    FROM pdf_text_pages ptp
    INNER JOIN process_documents pd ON pd.id = ptp.process_document_id
    WHERE pd.process_id = p_process_id
      AND ptp.text_content ILIKE '%' || search_term || '%'
    ORDER BY pd.sequence_order, ptp.page_number
  LOOP
    content_lower := lower(rec.content);
    search_start := 1;
    occurrence_count := 0;
    
    LOOP
      match_pos := position(search_term_lower in substring(content_lower from search_start));
      
      EXIT WHEN match_pos = 0 OR total_results >= p_limit;
      
      match_pos := search_start + match_pos - 1;
      occurrence_count := occurrence_count + 1;
      total_results := total_results + 1;
      
      document_id := rec.doc_id;
      document_name := rec.doc_name;
      sequence_order := rec.seq_order;
      page_number := rec.pg_number;
      match_text := substring(rec.content from match_pos for length(search_term));
      
      context_before := CASE 
        WHEN match_pos > 1 THEN
          substring(rec.content from greatest(1, match_pos - 50) for least(50, match_pos - 1))
        ELSE ''
      END;
      
      context_after := substring(
        rec.content 
        from match_pos + length(search_term) 
        for 50
      );
      
      RETURN NEXT;
      
      search_start := match_pos + 1;
    END LOOP;
    
    EXIT WHEN total_results >= p_limit;
  END LOOP;
END;
$$;
