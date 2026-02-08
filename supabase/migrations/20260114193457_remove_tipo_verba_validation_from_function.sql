/*
  # Remove character validation from add_custom_enum_value function

  1. Changes
    - Updates the add_custom_enum_value function to remove all regex validation for tipo_verba
    - Removes blocking of HTML tags, SQL comments, and other patterns
    - Keeps only basic length validation (2-100 characters)

  2. Reason
    - User requested to allow ALL characters without any restrictions
    - The function should only validate minimum and maximum length

  3. Notes
    - This affects how new custom tipo_verba values are created
    - All character types are now accepted including special chars, HTML, SQL patterns
*/

CREATE OR REPLACE FUNCTION public.add_custom_enum_value(
    p_enum_name text,
    p_enum_value text,
    p_process_id uuid DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    normalized_value text;
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
    
    -- Insere na tabela de valores personalizados
    -- ON CONFLICT garante que valores duplicados sejam ignorados silenciosamente
    INSERT INTO public.custom_enum_values (enum_name, enum_value, created_by_process_id)
    VALUES (p_enum_name, normalized_value, p_process_id)
    ON CONFLICT (enum_name, enum_value) DO NOTHING;
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro e retorna false para permitir tratamento gracioso
        RAISE NOTICE 'Erro ao adicionar valor personalizado: % - %', SQLERRM, SQLSTATE;
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.add_custom_enum_value(text, text, uuid) IS 'Adiciona valor personalizado a um enum dinâmico. Aceita qualquer caractere. Validação: 2-100 caracteres.';