/*
  # Add enum value existence check function

  1. New Functions
    - `check_enum_value_exists(p_enum_name, p_enum_value)` 
      - Verifica se um valor específico existe em um enum do PostgreSQL
      - Retorna boolean (true se existe, false caso contrário)
      - Usado pelo sistema de enums dinâmicos para validar valores antes de operações

  2. Functionality
    - Busca o OID do tipo enum na tabela pg_type
    - Verifica se o valor existe na tabela pg_enum
    - Suporta verificação de qualquer enum no schema public
    - Tratamento de erro para enums inexistentes

  3. Security
    - Função segura que apenas consulta metadados do PostgreSQL
    - Não permite modificação de dados
    - Acesso público para uso pelos componentes da aplicação
*/

-- Cria função para verificar se um valor existe em um enum específico
CREATE OR REPLACE FUNCTION public.check_enum_value_exists(
    p_enum_name text,
    p_enum_value text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    enum_type_oid oid;
    value_exists boolean;
BEGIN
    -- Busca o OID do tipo enum na tabela de tipos do PostgreSQL
    SELECT t.oid INTO enum_type_oid
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = p_enum_name AND n.nspname = 'public';

    -- Se o tipo enum não existe, retorna false
    IF enum_type_oid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verifica se o valor específico existe no enum
    SELECT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumtypid = enum_type_oid AND enumlabel = p_enum_value
    ) INTO value_exists;

    RETURN value_exists;
END;
$$;