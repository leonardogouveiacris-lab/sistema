/*
  # Remove all character restrictions from tipo_verba

  1. Changes
    - Drops the verbas_tipo_verba_no_special_chars constraint completely
    - Allows any characters in tipo_verba field
    - Keeps only length constraints (min 2, max 100 characters)

  2. Reason
    - User requested to allow ALL characters without any restrictions
    - Legal documents may contain special characters, symbols, etc.
    - Only basic length validation is maintained

  3. Notes
    - This removes all regex-based character validation
    - The field will accept any Unicode characters
    - Length constraints remain: minimum 2 chars, maximum 100 chars
*/

-- Drop the character restriction constraint from verbas table
ALTER TABLE public.verbas
  DROP CONSTRAINT IF EXISTS verbas_tipo_verba_no_special_chars;

-- Add a comment to document the change
COMMENT ON COLUMN public.verbas.tipo_verba IS
  'Tipo de verba trabalhista. Aceita qualquer caractere. Comprimento: 2-100 caracteres.';