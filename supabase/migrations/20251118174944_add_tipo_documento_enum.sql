/*
  # Add tipo_documento enum support

  1. Enum Creation
    - Create `tipo_documento` enum with predefined document types
    - Includes common document types like contracts, receipts, petitions, etc.

  2. Changes
    - Adds new enum type to the database for document type management
    - This enum will be used by the dynamic enum system
    - Allows custom document types to be added dynamically via the application

  3. Security
    - No RLS changes needed - this is just an enum type definition
    - Custom values will be tracked in the existing custom_enum_values table

  4. Integration
    - Works with existing DynamicEnumService
    - Supports the useTipoDocumentos hook
    - Used by DocumentoLancamentoForm and PDFDocumentoLancamentoFormInline components
*/

-- Create tipo_documento enum with predefined values
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
    CREATE TYPE tipo_documento AS ENUM (
      'Contrato de Trabalho',
      'CTPS',
      'Holerite',
      'Rescisão',
      'Recibos',
      'Termo de Ajuste de Conduta',
      'Procuração',
      'Atestado Médico',
      'Laudo Pericial',
      'Acordo',
      'Petição Inicial',
      'Contestação',
      'Outros Documentos'
    );
  END IF;
END $$;
