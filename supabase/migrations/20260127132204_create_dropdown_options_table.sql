/*
  # Criar tabela centralizada para opcoes de dropdown

  1. Nova Tabela
    - `dropdown_options`
      - `id` (uuid, primary key)
      - `dropdown_name` (text) - Nome do dropdown (ex: 'tipo_decisao', 'situacao_verba')
      - `option_value` (text) - Valor exibido no dropdown
      - `display_order` (integer) - Ordem de exibicao
      - `is_active` (boolean) - Permite desativar sem apagar
      - `created_at` (timestamptz)

  2. Dados Iniciais
    - Popula com todos os valores predefinidos atualmente hardcoded no codigo
    - tipo_decisao: 6 valores
    - situacao_decisao: 8 valores
    - tipo_documento: 15 valores
    - situacao_verba: 8 valores

  3. Security
    - RLS habilitado
    - Politica de leitura publica (valores sao compartilhados)
    - Politicas de escrita para administracao via Supabase Studio
*/

-- Criar tabela dropdown_options
CREATE TABLE IF NOT EXISTS dropdown_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dropdown_name text NOT NULL,
  option_value text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT dropdown_options_unique UNIQUE (dropdown_name, option_value)
);

-- Criar indice para busca por dropdown_name
CREATE INDEX IF NOT EXISTS idx_dropdown_options_name ON dropdown_options(dropdown_name);
CREATE INDEX IF NOT EXISTS idx_dropdown_options_active ON dropdown_options(dropdown_name, is_active);

-- Habilitar RLS
ALTER TABLE dropdown_options ENABLE ROW LEVEL SECURITY;

-- Politica de leitura para todos (valores predefinidos sao publicos)
CREATE POLICY "Permitir leitura de opcoes de dropdown"
  ON dropdown_options
  FOR SELECT
  USING (true);

-- Inserir valores predefinidos para tipo_decisao
INSERT INTO dropdown_options (dropdown_name, option_value, display_order) VALUES
  ('tipo_decisao', 'Sentença', 1),
  ('tipo_decisao', 'Acórdão', 2),
  ('tipo_decisao', 'Despacho', 3),
  ('tipo_decisao', 'Decisão Interlocutória', 4),
  ('tipo_decisao', 'Decisão Monocrática', 5),
  ('tipo_decisao', 'Embargos de Declaração', 6)
ON CONFLICT (dropdown_name, option_value) DO NOTHING;

-- Inserir valores predefinidos para situacao_decisao
INSERT INTO dropdown_options (dropdown_name, option_value, display_order) VALUES
  ('situacao_decisao', 'Procedente', 1),
  ('situacao_decisao', 'Improcedente', 2),
  ('situacao_decisao', 'Parcialmente Procedente', 3),
  ('situacao_decisao', 'Extinto sem Julgamento do Mérito', 4),
  ('situacao_decisao', 'Homologado', 5),
  ('situacao_decisao', 'Rejeitado', 6),
  ('situacao_decisao', 'Deferido', 7),
  ('situacao_decisao', 'Indeferido', 8)
ON CONFLICT (dropdown_name, option_value) DO NOTHING;

-- Inserir valores predefinidos para tipo_documento
INSERT INTO dropdown_options (dropdown_name, option_value, display_order) VALUES
  ('tipo_documento', 'Contrato de Trabalho', 1),
  ('tipo_documento', 'CTPS', 2),
  ('tipo_documento', 'Holerite', 3),
  ('tipo_documento', 'Rescisão', 4),
  ('tipo_documento', 'Recibos', 5),
  ('tipo_documento', 'Termo de Ajuste de Conduta', 6),
  ('tipo_documento', 'Procuração', 7),
  ('tipo_documento', 'Atestado Médico', 8),
  ('tipo_documento', 'Laudo Pericial', 9),
  ('tipo_documento', 'Acordo', 10),
  ('tipo_documento', 'Petição Inicial', 11),
  ('tipo_documento', 'Contestação', 12),
  ('tipo_documento', 'RR', 13),
  ('tipo_documento', 'AIRR', 14),
  ('tipo_documento', 'Outros Documentos', 15)
ON CONFLICT (dropdown_name, option_value) DO NOTHING;

-- Inserir valores predefinidos para situacao_verba
INSERT INTO dropdown_options (dropdown_name, option_value, display_order) VALUES
  ('situacao_verba', 'Deferida', 1),
  ('situacao_verba', 'Indeferida', 2),
  ('situacao_verba', 'Parcialmente Deferida', 3),
  ('situacao_verba', 'Reformada', 4),
  ('situacao_verba', 'Excluída', 5),
  ('situacao_verba', 'Em Análise', 6),
  ('situacao_verba', 'Aguardando Documentação', 7),
  ('situacao_verba', 'Improcedente', 8)
ON CONFLICT (dropdown_name, option_value) DO NOTHING;
