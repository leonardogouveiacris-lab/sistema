/*
  # Criar Tabela de Lançamentos de Documentos

  1. Nova Tabela
    - `lancamentos_documentos`
      - `id` (uuid, chave primária)
      - `process_id` (uuid, foreign key para processes)
      - `tipo_documento` (text) - Tipo do documento
      - `comentarios` (text, opcional) - Comentários sobre o documento
      - `pagina_vinculada` (integer, opcional) - Página do PDF vinculada
      - `created_at` (timestamptz) - Timestamp de criação
      - `updated_at` (timestamptz) - Timestamp de última atualização

  2. Segurança
    - Habilitar RLS na tabela `lancamentos_documentos`
    - Políticas para usuários autenticados:
      - SELECT: visualizar todos os documentos
      - INSERT: criar novos documentos
      - UPDATE: atualizar documentos existentes
      - DELETE: deletar documentos

  3. Índices
    - Índice em `process_id` para buscas rápidas por processo
    - Índice em `pagina_vinculada` para filtros por página

  4. Triggers
    - Trigger para atualização automática de `updated_at`

  5. Comentários
    - Adicionar comentários explicativos nas colunas
*/

-- Criar tabela de lançamentos de documentos
CREATE TABLE IF NOT EXISTS lancamentos_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  comentarios text,
  pagina_vinculada integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints de validação
  CONSTRAINT lancamentos_documentos_tipo_not_empty CHECK (length(TRIM(BOTH FROM tipo_documento)) > 0),
  CONSTRAINT lancamentos_documentos_comentarios_max_length CHECK (
    comentarios IS NULL OR length(comentarios) <= 5000
  ),
  CONSTRAINT lancamentos_documentos_pagina_positive CHECK (
    pagina_vinculada IS NULL OR pagina_vinculada > 0
  )
);

-- Comentários descritivos
COMMENT ON TABLE lancamentos_documentos IS 'Lançamentos de documentos vinculados aos processos';
COMMENT ON COLUMN lancamentos_documentos.process_id IS 'Referência ao processo ao qual o documento pertence';
COMMENT ON COLUMN lancamentos_documentos.tipo_documento IS 'Tipo/categoria do documento (ex: Contrato, Procuração, etc.)';
COMMENT ON COLUMN lancamentos_documentos.comentarios IS 'Comentários ou observações sobre o documento';
COMMENT ON COLUMN lancamentos_documentos.pagina_vinculada IS 'Página do PDF onde o documento está localizado (opcional)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lancamentos_documentos_process_id 
  ON lancamentos_documentos USING btree (process_id);

CREATE INDEX IF NOT EXISTS idx_lancamentos_documentos_pagina 
  ON lancamentos_documentos USING btree (pagina_vinculada) 
  WHERE pagina_vinculada IS NOT NULL;

-- Habilitar Row Level Security
ALTER TABLE lancamentos_documentos ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem visualizar todos os documentos
CREATE POLICY "Users can view documentos"
  ON lancamentos_documentos
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Usuários autenticados podem criar documentos
CREATE POLICY "Users can create documentos"
  ON lancamentos_documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Usuários autenticados podem atualizar documentos
CREATE POLICY "Users can update documentos"
  ON lancamentos_documentos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: Usuários autenticados podem deletar documentos
CREATE POLICY "Users can delete documentos"
  ON lancamentos_documentos
  FOR DELETE
  TO authenticated
  USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_lancamentos_documentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_lancamentos_documentos_updated_at
  BEFORE UPDATE ON lancamentos_documentos
  FOR EACH ROW
  EXECUTE FUNCTION update_lancamentos_documentos_updated_at();