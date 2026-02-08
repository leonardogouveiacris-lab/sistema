/*
  # Create functions to remove highlight IDs from lancamentos arrays
  
  1. New Functions
    - `remove_highlight_id_from_verba_lancamentos` - Removes a highlight ID from all verba_lancamentos.highlight_ids arrays
    - `remove_highlight_id_from_lancamentos_documentos` - Removes a highlight ID from all lancamentos_documentos.highlight_ids arrays
  
  2. Purpose
    - When a highlight is deleted, its ID should be removed from all lancamentos that reference it
    - This maintains data integrity and ensures accurate highlight counts in the UI
*/

CREATE OR REPLACE FUNCTION remove_highlight_id_from_verba_lancamentos(highlight_id_to_remove TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE verba_lancamentos
  SET highlight_ids = array_remove(highlight_ids, highlight_id_to_remove),
      updated_at = now()
  WHERE highlight_ids @> ARRAY[highlight_id_to_remove];
END;
$$;

CREATE OR REPLACE FUNCTION remove_highlight_id_from_lancamentos_documentos(highlight_id_to_remove TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE lancamentos_documentos
  SET highlight_ids = array_remove(highlight_ids, highlight_id_to_remove),
      updated_at = now()
  WHERE highlight_ids @> ARRAY[highlight_id_to_remove];
END;
$$;
