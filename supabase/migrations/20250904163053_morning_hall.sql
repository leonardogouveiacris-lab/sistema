/*
  # Permitir valores de enum duplicados por processo

  Esta migração resolve o problema onde o sistema não permite que o mesmo tipo
  de verba exista em processos diferentes. A solução implementa:

  1. Modificação das Constraints
     - Remove constraint de unicidade global atual
     - Adiciona constraint de unicidade para valores globais (sem process_id)
     - Adiciona constraint de unicidade por processo (com process_id)

  2. Atualização de Funções
     - Modifica função check_enum_value_exists para considerar process_id
     - Mantém compatibilidade com código existente

  3. Comportamento Resultante
     - Valores globais (created_by_process_id = NULL) são únicos globalmente
     - Valores por processo (created_by_process_id != NULL) são únicos por processo
     - Mesmo tipo de verba pode existir em processos diferentes

  Exemplo:
  - Processo A pode ter "Danos Morais" personalizado
  - Processo B pode ter "Danos Morais" personalizado (diferente do A)
  - Ambos coexistem no sistema sem conflito
*/

-- Etapa 1: Remove a constraint de unicidade atual que impede duplicatas
ALTER TABLE IF EXISTS public.custom_enum_values 
DROP CONSTRAINT IF EXISTS custom_enum_values_unique_per_enum;

-- Etapa 2: Cria constraint para valores globais (sem process_id específico)
-- Garante que valores globais permanecem únicos entre si
CREATE UNIQUE INDEX IF NOT EXISTS custom_enum_values_unique_global
ON public.custom_enum_values (enum_name, enum_value)
WHERE created_by_process_id IS NULL;

-- Etapa 3: Cria constraint para valores específicos por processo
-- Permite que o mesmo enum_value exista em processos diferentes
CREATE UNIQUE INDEX IF NOT EXISTS custom_enum_values_unique_per_process_context
ON public.custom_enum_values (enum_name, enum_value, created_by_process_id)
WHERE created_by_process_id IS NOT NULL;

-- Etapa 4: Atualiza função para verificar existência considerando contexto do processo
CREATE OR REPLACE FUNCTION public.check_enum_value_exists(
    p_enum_name text,
    p_enum_value text,
    p_process_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    value_exists boolean := false;
BEGIN
    -- Se process_id é fornecido, verifica no contexto do processo
    IF p_process_id IS NOT NULL THEN
        -- Verifica se existe um valor específico para este processo
        SELECT EXISTS (
            SELECT 1
            FROM public.custom_enum_values
            WHERE enum_name = p_enum_name
              AND enum_value = p_enum_value
              AND created_by_process_id = p_process_id
        ) INTO value_exists;
        
        -- Se não existe no processo, verifica se existe globalmente
        IF NOT value_exists THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.custom_enum_values
                WHERE enum_name = p_enum_name
                  AND enum_value = p_enum_value
                  AND created_by_process_id IS NULL
            ) INTO value_exists;
        END IF;
    ELSE
        -- Se process_id é NULL, verifica apenas valores globais
        SELECT EXISTS (
            SELECT 1
            FROM public.custom_enum_values
            WHERE enum_name = p_enum_name
              AND enum_value = p_enum_value
              AND created_by_process_id IS NULL
        ) INTO value_exists;
    END IF;
    
    RETURN value_exists;
END;
$$;

-- Etapa 5: Atualiza função para adicionar valores considerando contexto do processo
CREATE OR REPLACE FUNCTION public.add_custom_enum_value(
    p_enum_name text,
    p_enum_value text,
    p_process_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    value_exists boolean := false;
    insert_success boolean := false;
BEGIN
    -- Verifica se o valor já existe no contexto apropriado
    SELECT public.check_enum_value_exists(p_enum_name, p_enum_value, p_process_id) 
    INTO value_exists;
    
    IF value_exists THEN
        -- Valor já existe, retorna sucesso sem inserir
        RETURN true;
    END IF;
    
    -- Tenta inserir o novo valor
    BEGIN
        INSERT INTO public.custom_enum_values (
            enum_name, 
            enum_value, 
            created_by_process_id
        ) VALUES (
            p_enum_name, 
            p_enum_value, 
            p_process_id
        );
        
        insert_success := true;
        
    EXCEPTION 
        WHEN unique_violation THEN
            -- Se houve violação de unicidade (condição de corrida), 
            -- considera como sucesso pois o valor agora existe
            insert_success := true;
        WHEN OTHERS THEN
            -- Para outros erros, retorna false
            insert_success := false;
    END;
    
    RETURN insert_success;
END;
$$;

-- Etapa 6: Adiciona comentários nas constraints para documentação
COMMENT ON INDEX custom_enum_values_unique_global IS 
'Garante unicidade de valores globais (sem processo específico) para cada enum_name';

COMMENT ON INDEX custom_enum_values_unique_per_process_context IS 
'Permite valores duplicados entre processos diferentes, mantendo unicidade dentro do mesmo processo';

COMMENT ON FUNCTION public.check_enum_value_exists(text, text, uuid) IS 
'Verifica existência de valor em enum considerando contexto: global se process_id=NULL, específico do processo se process_id fornecido';

COMMENT ON FUNCTION public.add_custom_enum_value(text, text, uuid) IS 
'Adiciona valor a enum considerando contexto: global se process_id=NULL, específico do processo se process_id fornecido';