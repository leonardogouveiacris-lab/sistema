/*
  # Fix add_custom_enum_value function for partial unique indexes

  1. Problem
    - The function uses ON CONFLICT (enum_name, enum_value) but this constraint was removed
    - The table now uses PARTIAL unique indexes:
      - custom_enum_values_unique_global: (enum_name, enum_value) WHERE created_by_process_id IS NULL
      - custom_enum_values_unique_per_process_context: (enum_name, enum_value, created_by_process_id) WHERE created_by_process_id IS NOT NULL
    - ON CONFLICT doesn't work with partial indexes when column list doesn't match exactly
    - This causes INSERT to fail silently, returning inserted=false, already_existed=false

  2. Solution
    - Remove ON CONFLICT clause entirely
    - Rely on existence check before INSERT
    - Update existence check to consider process_id context correctly:
      - For global values (process_id IS NULL): check if value exists globally
      - For process values (process_id IS NOT NULL): check if value exists for that specific process
    - Catch unique_violation exception in case of race condition

  3. Changes
    - Modified existence check to consider process_id context
    - Removed ON CONFLICT clause from INSERT
    - Added specific exception handling for unique_violation

  4. Expected Results
    - New value: {"inserted": true, "already_existed": false}
    - Duplicate: {"inserted": false, "already_existed": true}
    - Error: {"inserted": false, "already_existed": false, "error": "message"}
*/

DROP FUNCTION IF EXISTS public.add_custom_enum_value(text, text, uuid);

CREATE OR REPLACE FUNCTION public.add_custom_enum_value(
    p_enum_name text,
    p_enum_value text,
    p_process_id uuid DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    normalized_value text;
    value_exists boolean;
BEGIN
    normalized_value := initcap(trim(both from p_enum_value));
    
    IF length(normalized_value) < 2 THEN
        RAISE EXCEPTION 'Valor deve ter pelo menos 2 caracteres: %', normalized_value;
    END IF;
    
    IF length(normalized_value) > 100 THEN
        RAISE EXCEPTION 'Valor deve ter no máximo 100 caracteres: %', normalized_value;
    END IF;
    
    IF p_process_id IS NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.custom_enum_values 
            WHERE enum_name = p_enum_name 
            AND enum_value = normalized_value
            AND created_by_process_id IS NULL
        ) INTO value_exists;
    ELSE
        SELECT EXISTS(
            SELECT 1 FROM public.custom_enum_values 
            WHERE enum_name = p_enum_name 
            AND enum_value = normalized_value
            AND (created_by_process_id = p_process_id OR created_by_process_id IS NULL)
        ) INTO value_exists;
    END IF;
    
    IF value_exists THEN
        RETURN jsonb_build_object(
            'inserted', false,
            'already_existed', true,
            'normalized_value', normalized_value
        );
    END IF;
    
    INSERT INTO public.custom_enum_values (enum_name, enum_value, created_by_process_id)
    VALUES (p_enum_name, normalized_value, p_process_id);
    
    RETURN jsonb_build_object(
        'inserted', true,
        'already_existed', false,
        'normalized_value', normalized_value
    );
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'inserted', false,
            'already_existed', true,
            'normalized_value', normalized_value
        );
    WHEN OTHERS THEN
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
'Adiciona valor personalizado a um enum dinâmico. Suporta valores globais (process_id NULL) e específicos por processo.';