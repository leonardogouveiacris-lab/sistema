/*
  # Sistema de Enum Dinâmico para Tipos de Verba

  Este script cria a infraestrutura necessária para permitir que usuários
  adicionem valores personalizados aos enums do sistema de forma dinâmica,
  mantendo a integridade referencial e a performance do banco de dados.

  1. Nova Tabela
    - `custom_enum_values` - Armazena valores personalizados dos enums
    - Campos: id, enum_name, enum_value, created_by_process_id, created_at

  2. Função para Adicionar Valores ao Enum
    - `add_custom_enum_value()` - Adiciona valor ao enum de forma segura
    - Verifica duplicatas antes de adicionar
    - Registra qual processo criou o valor

  3. Security
    - Enable RLS na nova tabela
    - Política para permitir acesso público (compatível com sistema atual)

  4. Índices
    - Índice único para prevenir duplicatas
    - Índice para busca por enum_name
*/

-- Criar tabela para armazenar valores personalizados dos enums
CREATE TABLE IF NOT EXISTS custom_enum_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enum_name text NOT NULL,                    -- Nome do enum (ex: 'tipo_verba')
  enum_value text NOT NULL,                   -- Valor a ser adicionado (ex: 'Teste')
  created_by_process_id uuid,                 -- Processo que criou este valor (opcional)
  created_at timestamptz DEFAULT now(),
  
  -- Constraint para evitar duplicatas
  UNIQUE(enum_name, enum_value)
);

-- Habilitar RLS na nova tabela
ALTER TABLE custom_enum_values ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso completo (compatível com sistema atual)
CREATE POLICY "Permitir acesso completo aos valores personalizados"
  ON custom_enum_values
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Índice para performance na busca por nome do enum
CREATE INDEX IF NOT EXISTS idx_custom_enum_values_enum_name 
  ON custom_enum_values (enum_name);

-- Índice para busca por processo criador
CREATE INDEX IF NOT EXISTS idx_custom_enum_values_process_id 
  ON custom_enum_values (created_by_process_id);

-- Função para adicionar valor ao enum de forma segura
CREATE OR REPLACE FUNCTION add_custom_enum_value(
  p_enum_name text,
  p_enum_value text,
  p_process_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_normalized_value text;
  v_enum_exists boolean;
BEGIN
  -- Normaliza o valor (capitaliza primeira letra de cada palavra)
  v_normalized_value := initcap(trim(p_enum_value));
  
  -- Verifica se é um valor válido (não vazio)
  IF v_normalized_value IS NULL OR length(v_normalized_value) < 1 THEN
    RAISE EXCEPTION 'Valor do enum não pode estar vazio';
  END IF;
  
  -- Verifica se o valor já existe no enum
  CASE p_enum_name
    WHEN 'tipo_verba' THEN
      BEGIN
        -- Tenta fazer um cast para verificar se o valor já existe
        PERFORM v_normalized_value::tipo_verba;
        v_enum_exists := true;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_enum_exists := false;
      END;
    WHEN 'situacao_verba' THEN
      BEGIN
        PERFORM v_normalized_value::situacao_verba;
        v_enum_exists := true;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_enum_exists := false;
      END;
    WHEN 'tipo_decisao' THEN
      BEGIN
        PERFORM v_normalized_value::tipo_decisao;
        v_enum_exists := true;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_enum_exists := false;
      END;
    WHEN 'situacao_decisao' THEN
      BEGIN
        PERFORM v_normalized_value::situacao_decisao;
        v_enum_exists := true;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_enum_exists := false;
      END;
    ELSE
      RAISE EXCEPTION 'Enum não suportado: %', p_enum_name;
  END CASE;
  
  -- Se o valor já existe no enum, não precisa adicionar
  IF v_enum_exists THEN
    -- Registra na tabela de controle se não estiver registrado
    INSERT INTO custom_enum_values (enum_name, enum_value, created_by_process_id)
    VALUES (p_enum_name, v_normalized_value, p_process_id)
    ON CONFLICT (enum_name, enum_value) DO NOTHING;
    
    RETURN true;
  END IF;
  
  -- Adiciona o valor ao enum usando ALTER TYPE
  CASE p_enum_name
    WHEN 'tipo_verba' THEN
      EXECUTE format('ALTER TYPE tipo_verba ADD VALUE %L', v_normalized_value);
    WHEN 'situacao_verba' THEN
      EXECUTE format('ALTER TYPE situacao_verba ADD VALUE %L', v_normalized_value);
    WHEN 'tipo_decisao' THEN
      EXECUTE format('ALTER TYPE tipo_decisao ADD VALUE %L', v_normalized_value);
    WHEN 'situacao_decisao' THEN
      EXECUTE format('ALTER TYPE situacao_decisao ADD VALUE %L', v_normalized_value);
  END CASE;
  
  -- Registra na tabela de controle
  INSERT INTO custom_enum_values (enum_name, enum_value, created_by_process_id)
  VALUES (p_enum_name, v_normalized_value, p_process_id)
  ON CONFLICT (enum_name, enum_value) DO NOTHING;
  
  -- Log da operação
  RAISE NOTICE 'Valor % adicionado ao enum % pelo processo %', 
    v_normalized_value, p_enum_name, COALESCE(p_process_id::text, 'sistema');
  
  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, registra e retorna false
    RAISE WARNING 'Erro ao adicionar valor % ao enum %: %', 
      v_normalized_value, p_enum_name, SQLERRM;
    RETURN false;
END;
$$;