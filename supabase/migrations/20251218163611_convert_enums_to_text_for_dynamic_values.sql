/*
  # Converter ENUMs Fixos para TEXT para Suportar Valores Dinâmicos

  ## Resumo das Mudanças
  Esta migração converte colunas que usam ENUMs fixos para TEXT, permitindo
  que o sistema de valores dinâmicos funcione corretamente em todas as tabelas.

  ## Problema Resolvido
  - O sistema estava criando valores personalizados na tabela custom_enum_values
  - Mas as colunas das tabelas ainda eram ENUMs fixos do PostgreSQL
  - Resultado: valores personalizados eram aceitos na tabela custom_enum_values,
    mas rejeitados ao tentar inserir nas tabelas principais

  ## Mudanças Implementadas
  1. **Tabela decisions**
     - Converte `tipo_decisao` de ENUM para TEXT
     - Converte `situacao` de ENUM para TEXT
     - Mantém valores existentes durante conversão

  2. **Tabela verba_lancamentos**
     - Converte `situacao` de ENUM para TEXT
     - Mantém valores existentes durante conversão

  3. **Views Dependentes**
     - Remove temporariamente view verbas_com_lancamentos
     - Recria view após conversão

  4. **Índices e Constraints**
     - Recria índices após conversão
     - Adiciona constraints de validação para garantir valores não vazios

  ## Compatibilidade
  - Todos os valores existentes são preservados
  - Valores predefinidos continuam funcionando
  - Novos valores personalizados agora são aceitos

  ## Segurança
  - Validações de NOT NULL mantidas
  - Constraints de integridade referencial preservadas
  - RLS policies não são afetadas
*/

-- ============================================================================
-- SEÇÃO 0: REMOVER VIEWS DEPENDENTES
-- ============================================================================

-- Salva a definição da view para recriá-la depois
-- (A view verbas_com_lancamentos depende da coluna situacao)
DROP VIEW IF EXISTS public.verbas_com_lancamentos CASCADE;

-- ============================================================================
-- SEÇÃO 1: CONVERSÃO DA TABELA DECISIONS
-- ============================================================================

-- Passo 1: Converter tipo_decisao de ENUM para TEXT
ALTER TABLE public.decisions
  ALTER COLUMN tipo_decisao TYPE TEXT USING tipo_decisao::TEXT;

-- Adicionar constraint para garantir que não seja vazio
ALTER TABLE public.decisions
  ADD CONSTRAINT decisions_tipo_decisao_not_empty
  CHECK (length(TRIM(tipo_decisao)) > 0);

-- Passo 2: Converter situacao de ENUM para TEXT
ALTER TABLE public.decisions
  ALTER COLUMN situacao TYPE TEXT USING situacao::TEXT;

-- Adicionar constraint para garantir que não seja vazio
ALTER TABLE public.decisions
  ADD CONSTRAINT decisions_situacao_not_empty
  CHECK (length(TRIM(situacao)) > 0);

-- Passo 3: Recriar índice para tipo_decisao (agora com TEXT)
DROP INDEX IF EXISTS public.idx_decisions_tipo_decisao;
CREATE INDEX idx_decisions_tipo_decisao ON public.decisions USING btree (tipo_decisao);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.decisions.tipo_decisao IS
'Tipo da decisão judicial (TEXT dinâmico - aceita valores predefinidos e personalizados)';

COMMENT ON COLUMN public.decisions.situacao IS
'Situação da decisão (TEXT dinâmico - aceita valores predefinidos e personalizados)';

-- ============================================================================
-- SEÇÃO 2: CONVERSÃO DA TABELA VERBA_LANCAMENTOS
-- ============================================================================

-- Passo 1: Converter situacao de ENUM para TEXT
ALTER TABLE public.verba_lancamentos
  ALTER COLUMN situacao TYPE TEXT USING situacao::TEXT;

-- Adicionar constraint para garantir que não seja vazio
ALTER TABLE public.verba_lancamentos
  ADD CONSTRAINT verba_lancamentos_situacao_not_empty
  CHECK (length(TRIM(situacao)) > 0);

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.verba_lancamentos.situacao IS
'Situação da verba nesta decisão (TEXT dinâmico - aceita valores predefinidos e personalizados)';

-- ============================================================================
-- SEÇÃO 3: RECRIAR VIEWS REMOVIDAS
-- ============================================================================

-- Recria a view verbas_com_lancamentos com as colunas agora em TEXT
CREATE OR REPLACE VIEW public.verbas_com_lancamentos AS
SELECT v.id,
    v.process_id,
    v.tipo_verba,
    v.created_at,
    v.updated_at,
    COALESCE(json_agg(json_build_object('id', vl.id, 'decisao_vinculada', vl.decisao_vinculada, 'situacao', vl.situacao, 'fundamentacao', vl.fundamentacao, 'comentarios_calculistas', vl.comentarios_calculistas, 'created_at', vl.created_at, 'updated_at', vl.updated_at) ORDER BY vl.created_at) FILTER (WHERE vl.id IS NOT NULL), '[]'::json) AS lancamentos
FROM verbas v
LEFT JOIN verba_lancamentos vl ON v.id = vl.verba_id
GROUP BY v.id, v.process_id, v.tipo_verba, v.created_at, v.updated_at
ORDER BY v.updated_at DESC;

COMMENT ON VIEW public.verbas_com_lancamentos IS
'View que combina verbas com seus lançamentos em formato JSON agregado';

-- ============================================================================
-- SEÇÃO 4: ATUALIZAÇÃO DAS FUNÇÕES DO BANCO
-- ============================================================================

/*
Atualiza a função check_enum_value_exists para verificar tanto em custom_enum_values
quanto nos valores predefinidos conhecidos do sistema
*/
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
    normalized_value text;
BEGIN
    -- Normaliza o valor para comparação consistente
    normalized_value := TRIM(p_enum_value);

    -- Verifica se o valor está vazio
    IF length(normalized_value) = 0 THEN
        RETURN false;
    END IF;

    -- Se process_id é fornecido, verifica no contexto do processo
    IF p_process_id IS NOT NULL THEN
        -- Verifica se existe um valor específico para este processo
        SELECT EXISTS (
            SELECT 1
            FROM public.custom_enum_values
            WHERE enum_name = p_enum_name
              AND enum_value = normalized_value
              AND created_by_process_id = p_process_id
        ) INTO value_exists;

        -- Se não existe no processo, verifica se existe globalmente
        IF NOT value_exists THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.custom_enum_values
                WHERE enum_name = p_enum_name
                  AND enum_value = normalized_value
                  AND created_by_process_id IS NULL
            ) INTO value_exists;
        END IF;
    ELSE
        -- Se process_id é NULL, verifica apenas valores globais
        SELECT EXISTS (
            SELECT 1
            FROM public.custom_enum_values
            WHERE enum_name = p_enum_name
              AND enum_value = normalized_value
              AND created_by_process_id IS NULL
        ) INTO value_exists;
    END IF;

    -- Se ainda não encontrou, verifica se é um valor predefinido conhecido
    IF NOT value_exists THEN
        -- Verifica valores predefinidos para cada tipo de enum
        CASE p_enum_name
            WHEN 'tipo_decisao' THEN
                value_exists := normalized_value IN (
                    'Sentença', 'Acórdão', 'Despacho',
                    'Decisão Interlocutória', 'Decisão Monocrática',
                    'Embargos de Declaração'
                );
            WHEN 'situacao_decisao' THEN
                value_exists := normalized_value IN (
                    'Procedente', 'Improcedente', 'Parcialmente Procedente',
                    'Extinto sem Julgamento do Mérito', 'Homologado',
                    'Rejeitado', 'Deferido', 'Indeferido'
                );
            WHEN 'situacao_verba' THEN
                value_exists := normalized_value IN (
                    'Deferida', 'Indeferida', 'Parcialmente Deferida',
                    'Reformada', 'Excluída', 'Em Análise',
                    'Aguardando Documentação', 'Improcedente'
                );
            ELSE
                -- Para outros enums, considera apenas o que está em custom_enum_values
                value_exists := false;
        END CASE;
    END IF;

    RETURN value_exists;
END;
$$;

COMMENT ON FUNCTION public.check_enum_value_exists(text, text, uuid) IS
'Verifica existência de valor em enum considerando: valores predefinidos, valores globais e valores específicos do processo';

/*
Atualiza a função add_custom_enum_value para normalizar valores corretamente
e adicionar à tabela custom_enum_values
*/
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
    normalized_value text;
    value_exists boolean := false;
    insert_success boolean := false;
BEGIN
    -- Normaliza o valor (trim de espaços)
    normalized_value := TRIM(p_enum_value);

    -- Validação básica de comprimento
    IF length(normalized_value) < 2 THEN
        RAISE EXCEPTION 'Valor deve ter pelo menos 2 caracteres';
    END IF;

    IF length(normalized_value) > 100 THEN
        RAISE EXCEPTION 'Valor deve ter no máximo 100 caracteres';
    END IF;

    -- Verifica se o valor já existe (considerando predefinidos também)
    SELECT public.check_enum_value_exists(p_enum_name, normalized_value, p_process_id)
    INTO value_exists;

    -- Se já existe como valor predefinido, não precisa adicionar
    IF value_exists THEN
        -- Verifica se existe na tabela custom_enum_values
        SELECT EXISTS (
            SELECT 1
            FROM public.custom_enum_values
            WHERE enum_name = p_enum_name
              AND enum_value = normalized_value
              AND (
                (p_process_id IS NULL AND created_by_process_id IS NULL) OR
                (created_by_process_id = p_process_id)
              )
        ) INTO value_exists;

        -- Se já existe na tabela, retorna sucesso
        IF value_exists THEN
            RETURN true;
        END IF;
    END IF;

    -- Tenta inserir o novo valor
    BEGIN
        INSERT INTO public.custom_enum_values (
            enum_name,
            enum_value,
            created_by_process_id
        ) VALUES (
            p_enum_name,
            normalized_value,
            p_process_id
        );

        insert_success := true;

    EXCEPTION
        WHEN unique_violation THEN
            -- Se houve violação de unicidade, considera como sucesso
            insert_success := true;
        WHEN OTHERS THEN
            -- Para outros erros, retorna false
            RAISE NOTICE 'Erro ao adicionar valor: % - %', SQLERRM, SQLSTATE;
            insert_success := false;
    END;

    RETURN insert_success;
END;
$$;

COMMENT ON FUNCTION public.add_custom_enum_value(text, text, uuid) IS
'Adiciona valor personalizado a um enum, validando e normalizando. Retorna true se valor foi adicionado ou já existia.';

-- ============================================================================
-- SEÇÃO 5: LIMPEZA E VALIDAÇÃO
-- ============================================================================

-- Verifica se há dados inconsistentes (valores vazios ou muito longos)
DO $$
DECLARE
    invalid_count integer;
BEGIN
    -- Verifica decisions.tipo_decisao
    SELECT COUNT(*) INTO invalid_count
    FROM public.decisions
    WHERE length(TRIM(tipo_decisao)) = 0 OR length(tipo_decisao) > 100;

    IF invalid_count > 0 THEN
        RAISE NOTICE 'Aviso: % registros em decisions.tipo_decisao com valores inválidos', invalid_count;
    END IF;

    -- Verifica decisions.situacao
    SELECT COUNT(*) INTO invalid_count
    FROM public.decisions
    WHERE length(TRIM(situacao)) = 0 OR length(situacao) > 100;

    IF invalid_count > 0 THEN
        RAISE NOTICE 'Aviso: % registros em decisions.situacao com valores inválidos', invalid_count;
    END IF;

    -- Verifica verba_lancamentos.situacao
    SELECT COUNT(*) INTO invalid_count
    FROM public.verba_lancamentos
    WHERE length(TRIM(situacao)) = 0 OR length(situacao) > 100;

    IF invalid_count > 0 THEN
        RAISE NOTICE 'Aviso: % registros em verba_lancamentos.situacao com valores inválidos', invalid_count;
    END IF;
END $$;

-- ============================================================================
-- MENSAGEM FINAL
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Migração concluída com sucesso!';
    RAISE NOTICE 'Colunas convertidas de ENUM para TEXT:';
    RAISE NOTICE '  - decisions.tipo_decisao';
    RAISE NOTICE '  - decisions.situacao';
    RAISE NOTICE '  - verba_lancamentos.situacao';
    RAISE NOTICE '';
    RAISE NOTICE 'View recriada: verbas_com_lancamentos';
    RAISE NOTICE 'O sistema agora aceita valores predefinidos E personalizados!';
    RAISE NOTICE '=================================================================';
END $$;
