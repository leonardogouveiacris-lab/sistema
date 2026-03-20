/*
  # Increase decisions observacoes character limit

  ## Summary
  The check constraint `decisions_observacoes_max_length` was set to 1000 characters.
  Since the `observacoes` field stores rich HTML content (from a WYSIWYG editor),
  HTML tags add significant overhead beyond the visible text. For example, a bulleted
  list or bold text can multiply the actual stored length by 2-3x.

  ## Changes
  - **Modified table:** `decisions`
  - **Change:** Drops the old `decisions_observacoes_max_length` constraint (1000 chars)
    and replaces it with a new one allowing up to 5000 characters, accommodating HTML
    formatting overhead from the rich text editor.

  ## Security
  No RLS changes. Existing policies remain in effect.

  ## Notes
  1. This is a non-destructive change — no existing data is altered.
  2. The frontend constant and validation will be updated to match this new limit.
  3. 5000 chars is sufficient for any realistic observation text with HTML formatting.
*/

ALTER TABLE public.decisions
  DROP CONSTRAINT IF EXISTS decisions_observacoes_max_length;

ALTER TABLE public.decisions
  ADD CONSTRAINT decisions_observacoes_max_length
    CHECK (observacoes IS NULL OR length(observacoes) <= 5000);
