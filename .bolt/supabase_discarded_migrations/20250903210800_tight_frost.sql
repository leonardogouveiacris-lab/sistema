/*
  # Limpeza de valores personalizados do Tipo de Verba

  1. Operação
    - Remove todos os valores personalizados da tabela `custom_enum_values`
    - Filtra apenas registros onde `enum_name = 'tipo_verba'`
    - Mantém integridade referencial do sistema

  2. Impacto
    - Dropdown "Tipo de Verba" volta apenas aos valores predefinidos
    - Valores personalizados criados pelos usuários são removidos
    - Sistema continua funcionando normalmente

  3. Segurança
    - Operação irreversível - valores personalizados serão perdidos
    - Não afeta dados existentes nas tabelas `verbas` (valores já salvos permanecem)
    - Apenas limpa opções disponíveis no dropdown
*/

-- Remove todos os valores personalizados do enum tipo_verba
DELETE FROM custom_enum_values 
WHERE enum_name = 'tipo_verba';