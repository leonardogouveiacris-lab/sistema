/*
  # Fix add_custom_enum_value to return detailed information

  1. Problem
    - The current function always returns true, making it impossible to know if a value was inserted or already existed
    - The ON CONFLICT DO NOTHING clause silently ignores duplicates without providing feedback
    - This causes the frontend to not know if the operation truly succeeded

  2. Solution
    - Drop and recreate function to return JSON with detailed information: {inserted: boolean, already_existed: boolean}
    - Use INSERT ... RETURNING to detect if a row was actually inserted
    - Check existence before attempting insert to provide accurate feedback

  3. Changes
    - Replace RETURNS BOOLEAN with RETURNS JSONB
    - Add logic to check if value exists before inserting
    - Return structured data: {"inserted": true/false, "already_existed": true/false}
    
  4. Examples
    - New value: {"inserted": true, "already_existed": false}
    - Duplicate: {"inserted": false, "already_existed": true}
*/

-- Drop the old function first
DROP FUNCTION IF EXISTS public.add_custom_enum_value(text, text, uuid);

-- Recreate with new return type
CREATE OR REPLACE FUNCTION public.add_custom_enum_value(
    p_enum_name text,
    p_enum_value text,
    p_process_id uuid DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    normalized_value text;
    value_exists boolean;
    inserted_count integer;
BEGIN
    -- Normaliza o valor (capitalização adequada, remove espaços extras)
    normalized_value := initcap(trim(both from p_enum_value));
    
    -- Validações básicas de comprimento apenas
    IF length(normalized_value) < 2 THEN
        RAISE EXCEPTION 'Valor deve ter pelo menos 2 caracteres: %', normalized_value;
    END IF;
    
    IF length(normalized_value) > 100 THEN
        RAISE EXCEPTION 'Valor deve ter no máximo 100 caracteres: %', normalized_value;
    END IF;
    
    -- Verifica se o valor já existe antes de tentar inserir
    SELECT EXISTS(
        SELECT 1 FROM public.custom_enum_values 
        WHERE enum_name = p_enum_name 
        AND enum_value = normalized_value
    ) INTO value_exists;
    
    -- Se já existe, retorna informação sem tentar inserir
    IF value_exists THEN
        RETURN jsonb_build_object(
            'inserted', false,
            'already_existed', true,
            'normalized_value', normalized_value
        );
    END IF;
    
    -- Tenta inserir o novo valor
    INSERT INTO public.custom_enum_values (enum_name, enum_value, created_by_process_id)
    VALUES (p_enum_name, normalized_value, p_process_id)
    ON CONFLICT (enum_name, enum_value) DO NOTHING;
    
    -- Verifica se a inserção foi bem-sucedida
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    -- Retorna resultado detalhado
    RETURN jsonb_build_object(
        'inserted', inserted_count > 0,
        'already_existed', inserted_count = 0,
        'normalized_value', normalized_value
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de erro, retorna informação estruturada
        RAISE NOTICE 'Erro ao adicionar valor personalizado: % - %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'inserted', false,
            'already_existed', false,
            'error', SQLERRM,
            'normalized_value', normalized_value
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.add_custom_enum_value(text, text, uuid) IS 
'Adiciona valor personalizado a um enum dinâmico e retorna informação detalhada sobre a operação. 
Retorna JSON: {inserted: boolean, already_existed: boolean, normalized_value: text}.';
