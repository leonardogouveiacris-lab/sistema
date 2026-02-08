/**
 * Tipos TypeScript gerados automaticamente para o esquema do banco Supabase
 * 
 * Este arquivo define a estrutura completa do banco de dados,
 * incluindo todas as tabelas, colunas, relacionamentos e constraints.
 * Os tipos são utilizados para garantir type safety em todas as operações.
 */

/**
 * Enum para tipos de decisão judicial
 */
export type TipoDecisaoEnum = 
  | 'Sentença'
  | 'Acórdão'
  | 'Despacho'
  | 'Decisão Interlocutória'
  | 'Decisão Monocrática'
  | 'Embargos de Declaração';

/**
 * Enum para situações das decisões
 */
export type SituacaoDecisaoEnum = 
  | 'Procedente'
  | 'Improcedente'
  | 'Parcialmente Procedente'
  | 'Extinto sem Julgamento do Mérito'
  | 'Homologado'
  | 'Rejeitado'
  | 'Deferido'
  | 'Indeferido';

/**
 * Enum para situações das verbas
 */
export type SituacaoVerbaEnum = 
  | 'Deferida'
  | 'Indeferida'
  | 'Parcialmente Deferida'
  | 'Reformada'
  | 'Excluída'
  | 'Em Análise'
  | 'Aguardando Documentação'
  | 'Improcedente';

/**
 * Tipo para status das verbas no processo
 */
export type StatusVerbasEnum = 'pendente' | 'em_andamento' | 'concluido';

/**
 * Interface para a tabela 'processes' (processos trabalhistas)
 */
export interface ProcessRecord {
  id: string;                    // UUID - Chave primária
  numero_processo: string;       // Número oficial do processo (único)
  reclamante: string;           // Nome do reclamante
  reclamada: string;            // Nome da empresa reclamada
  observacoes_gerais?: string;  // Observações adicionais (opcional)
  status_verbas: StatusVerbasEnum; // Status geral das verbas do processo
  created_at: string;           // Timestamp de criação (ISO)
  updated_at: string;           // Timestamp de atualização (ISO)
}

/**
 * Interface para a tabela 'decisions' (decisões judiciais)
 */
export interface DecisionRecord {
  id: string;                   // UUID - Chave primária
  process_id: string;           // UUID - Chave estrangeira para processes
  tipo_decisao: string;         // Tipo da decisão (TEXT dinâmico - aceita valores predefinidos e personalizados)
  id_decisao: string;           // Código/ID da decisão (ex: SEN-001)
  situacao: string;             // Situação da decisão (TEXT dinâmico - aceita valores predefinidos e personalizados)
  observacoes?: string;         // Observações adicionais (opcional)
  pagina_vinculada?: number;    // Página do PDF onde a decisão está vinculada (opcional)
  process_document_id?: string; // UUID - Chave estrangeira para process_documents (opcional)
  created_at: string;           // Timestamp de criação (ISO)
  updated_at: string;           // Timestamp de atualização (ISO)
}

/**
 * Interface para a tabela 'verbas' (verbas trabalhistas)
 */
export interface VerbaRecord {
  id: string;                   // UUID - Chave primária
  process_id: string;           // UUID - Chave estrangeira para processes
  tipo_verba: string;           // Tipo da verba trabalhista (TEXT dinâmico)
  created_at: string;           // Timestamp de criação (ISO)
  updated_at: string;           // Timestamp de atualização (ISO)
}

/**
 * Interface para a tabela 'verba_lancamentos' (lançamentos de verbas)
 */
export interface VerbaLancamentoRecord {
  id: string;                      // UUID - Chave primária
  verba_id: string;                // UUID - Chave estrangeira para verbas
  decisao_vinculada: string;       // ID da decisão vinculada
  situacao: string;                // Situação da verba nesta decisão (TEXT dinâmico - aceita valores predefinidos e personalizados)
  fundamentacao?: string;          // Fundamentação jurídica (rich text, opcional)
  comentarios_calculistas?: string; // Comentários dos calculistas (rich text, opcional)
  pagina_vinculada?: number;       // Página do PDF onde o lançamento está vinculado (opcional)
  process_document_id?: string;    // UUID - Chave estrangeira para process_documents (opcional)
  highlight_id?: string;           // UUID - Chave estrangeira para pdf_highlights (deprecated, use highlight_ids)
  highlight_ids?: string[];        // Array de UUIDs de highlights PDF vinculados (múltiplas seleções)
  check_calculista: boolean;       // Indica se o cálculo foi concluído
  check_calculista_at?: string;    // Timestamp de quando o check do calculista foi marcado (ISO)
  check_revisor: boolean;          // Indica se a revisão foi aprovada
  check_revisor_at?: string;       // Timestamp de quando o check do revisor foi marcado (ISO)
  created_at: string;              // Timestamp de criação (ISO)
  updated_at: string;              // Timestamp de atualização (ISO)
}

/**
 * Interface para registros de valores personalizados de enum
 */
export interface CustomEnumValueRecord {
  id: string;                      // UUID - Chave primária
  enum_name: string;               // Nome do enum (ex: 'tipo_verba')
  enum_value: string;              // Valor personalizado do enum
  created_by_process_id?: string;  // UUID - Processo criador (opcional)
  created_at: string;              // Timestamp de criação (ISO)
}

/**
 * Interface para a tabela 'process_documents' (documentos PDF dos processos)
 */
export interface ProcessDocumentRecord {
  id: string;                      // UUID - Chave primária
  process_id: string;              // UUID - Chave estrangeira para processes
  file_name: string;               // Nome original do arquivo PDF
  file_path: string;               // Caminho do arquivo no Supabase Storage
  file_size: number;               // Tamanho do arquivo em bytes
  mime_type: string;               // Tipo MIME (application/pdf)
  sequence_order: number;          // Ordem do PDF na sequência (1, 2, 3, ...)
  date_reference?: string;         // Data de referência opcional do PDF (ISO date)
  display_name: string;            // Nome de exibição gerado automaticamente
  created_at: string;              // Timestamp de upload (ISO)
  updated_at: string;              // Timestamp de atualização (ISO)
}

/**
 * Interface principal do banco de dados Supabase
 * 
 * Esta interface define toda a estrutura do banco,
 * organizando as tabelas em schemas lógicos
 */
export interface Database {
  public: {
    Tables: {
      // Tabela de processos trabalhistas
      processes: {
        Row: ProcessRecord;                    // Dados completos de uma linha
        Insert: Omit<ProcessRecord, 'id' | 'created_at' | 'updated_at'>; // Dados para inserção
        Update: Partial<Omit<ProcessRecord, 'id' | 'created_at'>>;       // Dados para atualização
      };
      
      // Tabela de decisões judiciais
      decisions: {
        Row: DecisionRecord;
        Insert: Omit<DecisionRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DecisionRecord, 'id' | 'created_at'>>;
      };
      
      // Tabela de verbas trabalhistas
      verbas: {
        Row: VerbaRecord;
        Insert: Omit<VerbaRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VerbaRecord, 'id' | 'created_at'>>;
      };
      
      // Tabela de lançamentos de verbas
      verba_lancamentos: {
        Row: VerbaLancamentoRecord;
        Insert: Omit<VerbaLancamentoRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VerbaLancamentoRecord, 'id' | 'created_at'>>;
      };
      
      // Tabela de valores personalizados para enums dinâmicos
      custom_enum_values: {
        Row: CustomEnumValueRecord;
        Insert: Omit<CustomEnumValueRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<CustomEnumValueRecord, 'id' | 'created_at'>>;
      };

      // Tabela de documentos PDF dos processos
      process_documents: {
        Row: ProcessDocumentRecord;
        Insert: Omit<ProcessDocumentRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProcessDocumentRecord, 'id' | 'created_at'>>;
      };
    };
    
    // Views (consultas pré-definidas)
    Views: {
      // View que combina verbas com seus lançamentos
      verbas_com_lancamentos: {
        Row: VerbaRecord & {
          lancamentos: VerbaLancamentoRecord[];
        };
      };
    };
    
    // Funções definidas no banco
    Functions: {
      // Função para buscar verbas com lançamentos por processo
      get_verbas_by_process: {
        Args: { process_id: string };
        Returns: VerbaRecord[];
      };
      
      // Função para adicionar valores personalizados aos enums
      add_custom_enum_value: {
        Args: {
          p_enum_name: string;
          p_enum_value: string;
          p_process_id?: string;
        };
        Returns: {
          inserted: boolean;
          already_existed: boolean;
          normalized_value: string;
          error?: string;
        };
      };
      
      // Função para verificar se valor existe em enum
      check_enum_value_exists: {
        Args: {
          p_enum_name: string;
          p_enum_value: string;
        };
        Returns: boolean;
      };
      
      // Função para buscar tipos distintos de verba
      get_distinct_tipo_verba_values: {
        Args: { p_process_id?: string };
        Returns: { tipo_verba: string }[];
      };
    };
    
    // Enums definidos no banco (apenas para referência - colunas agora são TEXT)
    // IMPORTANTE: As colunas no banco agora são TEXT dinâmico, não ENUMs fixos
    // Os valores abaixo são mantidos como referência dos valores predefinidos
    // Mas o sistema aceita valores personalizados através de custom_enum_values
    Enums: {
      tipo_decisao: TipoDecisaoEnum;
      situacao_decisao: SituacaoDecisaoEnum;
      situacao_verba: SituacaoVerbaEnum;
    };
  };
}