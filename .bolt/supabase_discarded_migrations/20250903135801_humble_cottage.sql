/*
# Esquema Inicial - Sistema de Revisão de Verbas Trabalhistas

Este arquivo contém a estrutura inicial do banco de dados para o sistema
de revisão de verbas trabalhistas. O esquema inclui:

## 1. Tabelas Principais
- `processes` - Processos trabalhistas
- `decisions` - Decisões judiciais
- `verbas` - Verbas trabalhistas 
- `verba_lancamentos` - Lançamentos de verbas (decisões específicas)

## 2. Segurança (RLS)
- Row Level Security habilitado em todas as tabelas
- Políticas básicas para acesso público (temporário)

## 3. Índices
- Índices otimizados para consultas frequentes
- Chaves estrangeiras com índices automáticos

## 4. Triggers
- Trigger para atualização automática de timestamps
*/

-- =============================================
-- EXTENSÕES NECESSÁRIAS
-- =============================================

-- Extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- FUNÇÃO PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMPS
-- =============================================

/**
 * Função para atualizar automaticamente o campo updated_at
 * Esta função será chamada por triggers em todas as tabelas
 */
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- CRIAÇÃO DOS ENUMS
-- =============================================

/**
 * Enum para tipos de decisão judicial
 * Define os tipos padrão de decisões no sistema trabalhista
 */
CREATE TYPE tipo_decisao AS ENUM (
    'Sentença',
    'Acórdão',
    'Despacho',
    'Decisão Interlocutória',
    'Decisão Monocrática',
    'Embargos de Declaração'
);

/**
 * Enum para situações das decisões
 * Define os possíveis resultados de uma decisão judicial
 */
CREATE TYPE situacao_decisao AS ENUM (
    'Procedente',
    'Improcedente',
    'Parcialmente Procedente',
    'Extinto sem Julgamento do Mérito',
    'Homologado',
    'Rejeitado',
    'Deferido',
    'Indeferido'
);

/**
 * Enum para tipos de verba trabalhista
 * Define as categorias padrão de verbas trabalhistas
 */
CREATE TYPE tipo_verba AS ENUM (
    'Salários',
    'Horas Extras',
    'Adicional Noturno',
    'Insalubridade',
    'Periculosidade',
    'Férias',
    '13º Salário',
    'FGTS',
    'Multa 40% FGTS',
    'Aviso Prévio',
    'Seguro Desemprego',
    'PIS/PASEP',
    'Vale Transporte',
    'Vale Refeição',
    'Plano de Saúde',
    'Danos Morais',
    'Outros'
);

/**
 * Enum para situações das verbas
 * Define os possíveis status de uma verba em uma decisão
 */
CREATE TYPE situacao_verba AS ENUM (
    'Deferida',
    'Indeferida',
    'Parcialmente Deferida',
    'Reformada',
    'Excluída',
    'Em Análise',
    'Aguardando Documentação',
    'Improcedente'
);

-- =============================================
-- TABELA: PROCESSES (Processos Trabalhistas)
-- =============================================

/**
 * Tabela principal para armazenar processos trabalhistas
 * 
 * Esta tabela contém as informações básicas de cada processo,
 * incluindo partes envolvidas e dados de auditoria
 */
CREATE TABLE IF NOT EXISTS processes (
    -- Chave primária UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Número oficial do processo (único e obrigatório)
    numero_processo TEXT NOT NULL UNIQUE,
    
    -- Partes do processo (obrigatórias)
    reclamante TEXT NOT NULL,
    reclamada TEXT NOT NULL,
    
    -- Observações gerais (opcional)
    observacoes_gerais TEXT,
    
    -- Campos de auditoria (gerenciados automaticamente)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints adicionais
    CONSTRAINT processes_numero_processo_min_length CHECK (LENGTH(numero_processo) >= 5),
    CONSTRAINT processes_reclamante_not_empty CHECK (LENGTH(TRIM(reclamante)) > 0),
    CONSTRAINT processes_reclamada_not_empty CHECK (LENGTH(TRIM(reclamada)) > 0)
);

-- Habilita Row Level Security para a tabela processes
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- Trigger para atualização automática do updated_at
CREATE TRIGGER update_processes_updated_at
    BEFORE UPDATE ON processes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TABELA: DECISIONS (Decisões Judiciais)
-- =============================================

/**
 * Tabela para armazenar decisões judiciais vinculadas aos processos
 * 
 * Cada decisão representa um momento específico do processo
 * (sentença, acórdão, despacho, etc.)
 */
CREATE TABLE IF NOT EXISTS decisions (
    -- Chave primária UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referência ao processo (obrigatória)
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    
    -- Informações da decisão
    tipo_decisao tipo_decisao NOT NULL,
    id_decisao TEXT NOT NULL,
    situacao situacao_decisao NOT NULL,
    
    -- Observações adicionais (opcional)
    observacoes TEXT,
    
    -- Campos de auditoria
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT decisions_id_decisao_min_length CHECK (LENGTH(id_decisao) >= 3),
    CONSTRAINT decisions_unique_per_process UNIQUE (process_id, id_decisao)
);

-- Habilita Row Level Security
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER update_decisions_updated_at
    BEFORE UPDATE ON decisions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índice para consultas por processo
CREATE INDEX idx_decisions_process_id ON decisions(process_id);

-- =============================================
-- TABELA: VERBAS (Verbas Trabalhistas)
-- =============================================

/**
 * Tabela principal para tipos de verbas trabalhistas
 * 
 * Cada registro representa um tipo específico de verba
 * vinculada a um processo (ex: Horas Extras, Danos Morais)
 */
CREATE TABLE IF NOT EXISTS verbas (
    -- Chave primária UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referência ao processo (obrigatória)
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    
    -- Tipo da verba trabalhista
    tipo_verba tipo_verba NOT NULL,
    
    -- Campos de auditoria
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint para evitar duplicatas de tipo por processo
    CONSTRAINT verbas_unique_tipo_per_process UNIQUE (process_id, tipo_verba)
);

-- Habilita Row Level Security
ALTER TABLE verbas ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER update_verbas_updated_at
    BEFORE UPDATE ON verbas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índice para consultas por processo
CREATE INDEX idx_verbas_process_id ON verbas(process_id);

-- =============================================
-- TABELA: VERBA_LANCAMENTOS (Lançamentos de Verbas)
-- =============================================

/**
 * Tabela para lançamentos específicos de verbas por decisão
 * 
 * Cada lançamento representa como uma verba foi tratada
 * em uma decisão específica (deferida, indeferida, etc.)
 */
CREATE TABLE IF NOT EXISTS verba_lancamentos (
    -- Chave primária UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referência à verba (obrigatória)
    verba_id UUID NOT NULL REFERENCES verbas(id) ON DELETE CASCADE,
    
    -- Informações do lançamento
    decisao_vinculada TEXT NOT NULL,
    situacao situacao_verba NOT NULL,
    
    -- Textos ricos (opcional)
    fundamentacao TEXT,
    comentarios_calculistas TEXT,
    
    -- Campos de auditoria
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT verba_lancamentos_decisao_not_empty CHECK (LENGTH(TRIM(decisao_vinculada)) > 0)
);

-- Habilita Row Level Security
ALTER TABLE verba_lancamentos ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER update_verba_lancamentos_updated_at
    BEFORE UPDATE ON verba_lancamentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índices para otimização de consultas
CREATE INDEX idx_verba_lancamentos_verba_id ON verba_lancamentos(verba_id);
CREATE INDEX idx_verba_lancamentos_decisao ON verba_lancamentos(decisao_vinculada);

-- =============================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- =============================================

/**
 * Políticas temporárias para acesso público
 * Em produção, estas devem ser ajustadas conforme necessário
 */

-- Política para a tabela processes
CREATE POLICY "Permitir acesso completo aos processos"
    ON processes
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Política para a tabela decisions
CREATE POLICY "Permitir acesso completo às decisões"
    ON decisions
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Política para a tabela verbas
CREATE POLICY "Permitir acesso completo às verbas"
    ON verbas
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Política para a tabela verba_lancamentos
CREATE POLICY "Permitir acesso completo aos lançamentos"
    ON verba_lancamentos
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- =============================================
-- VIEWS ÚTEIS
-- =============================================

/**
 * View que combina verbas com seus lançamentos
 * Útil para consultas hierárquicas
 */
CREATE OR REPLACE VIEW verbas_com_lancamentos AS
SELECT 
    v.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', vl.id,
                'decisao_vinculada', vl.decisao_vinculada,
                'situacao', vl.situacao,
                'fundamentacao', vl.fundamentacao,
                'comentarios_calculistas', vl.comentarios_calculistas,
                'created_at', vl.created_at,
                'updated_at', vl.updated_at
            ) ORDER BY vl.created_at DESC
        ) FILTER (WHERE vl.id IS NOT NULL),
        '[]'::json
    ) as lancamentos
FROM verbas v
LEFT JOIN verba_lancamentos vl ON v.id = vl.verba_id
GROUP BY v.id, v.process_id, v.tipo_verba, v.created_at, v.updated_at;

-- =============================================
-- FUNÇÕES UTILITÁRIAS
-- =============================================

/**
 * Função para buscar todas as verbas de um processo com seus lançamentos
 * 
 * @param p_process_id UUID do processo
 * @returns JSON com estrutura hierárquica das verbas
 */
CREATE OR REPLACE FUNCTION get_verbas_by_process(p_process_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(row_to_json(verbas_com_lancamentos)), '[]')
        FROM verbas_com_lancamentos
        WHERE process_id = p_process_id
        ORDER BY created_at DESC
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMENTÁRIOS FINAIS
-- =============================================

COMMENT ON TABLE processes IS 'Tabela principal para processos trabalhistas';
COMMENT ON TABLE decisions IS 'Decisões judiciais vinculadas aos processos';
COMMENT ON TABLE verbas IS 'Tipos de verbas trabalhistas por processo';
COMMENT ON TABLE verba_lancamentos IS 'Lançamentos específicos de verbas por decisão';

COMMENT ON VIEW verbas_com_lancamentos IS 'View que combina verbas com seus lançamentos em estrutura hierárquica';
COMMENT ON FUNCTION get_verbas_by_process(UUID) IS 'Retorna todas as verbas de um processo em formato JSON hierárquico';