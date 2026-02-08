/*
  # Adicionar categoria tipo_documento_pdf para gerenciamento de tipos de PDF

  1. Novos Dados
    - Categoria: tipo_documento_pdf
    - Valores: ATOrd, CumPrSe, ROT, INI, ATual

  2. Propósito
    - Permitir gerenciamento dinâmico dos tipos de documento PDF
    - Os valores são usados para nomeação de arquivos no upload
*/

INSERT INTO dropdown_options (dropdown_name, option_value, display_order, is_active)
VALUES 
  ('tipo_documento_pdf', 'ATOrd', 1, true),
  ('tipo_documento_pdf', 'CumPrSe', 2, true),
  ('tipo_documento_pdf', 'ROT', 3, true),
  ('tipo_documento_pdf', 'INI', 4, true),
  ('tipo_documento_pdf', 'ATual', 5, true)
ON CONFLICT (dropdown_name, option_value) DO NOTHING;