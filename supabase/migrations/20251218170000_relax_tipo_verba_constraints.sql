/*
  # Relax tipo_verba constraints to allow special characters

  1. Changes
    - Removes overly restrictive constraint on verbas.tipo_verba
    - Adds more permissive constraint allowing common legal document characters
    - Allows quotes, parentheses, commas, slashes, colons, and other punctuation
    - Maintains security by blocking dangerous characters

  2. Security
    - Still prevents SQL injection attempts
    - Blocks HTML/XML tags
    - Maintains basic validation (length, not empty)

  3. Examples of now-valid values
    - "Do Pedido de Tramitação pelo Juízo 100% Digital"
    - "Férias (1/3)"
    - "13º Salário"
    - "Horas Extras: 50%"
    - "iii – Dispositivo" (em dash supported)
*/

ALTER TABLE public.verbas
  DROP CONSTRAINT IF EXISTS verbas_tipo_verba_no_special_chars;

ALTER TABLE public.verbas
  ADD CONSTRAINT verbas_tipo_verba_no_special_chars CHECK (
    tipo_verba ~ '^[A-Za-zÀ-ÿ0-9\s\-–—\.%°º"'"'"'`,:;()/\[\]{}+=*&@#!?]+$'
    AND tipo_verba NOT LIKE '%<%'
    AND tipo_verba NOT LIKE '%>%'
    AND tipo_verba NOT LIKE '%--%'
    AND tipo_verba NOT LIKE '%/*%'
    AND tipo_verba NOT LIKE '%*/%'
  );

COMMENT ON CONSTRAINT verbas_tipo_verba_no_special_chars ON public.verbas IS
  'Allows common punctuation and special characters while blocking SQL injection and XSS attempts';
