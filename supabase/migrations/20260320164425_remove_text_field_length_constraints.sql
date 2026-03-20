/*
  # Remove character length constraints from free-text fields

  ## Summary
  Removes CHECK constraints that imposed maximum character limits on free-text
  fields across lançamentos, decisões, processos, and documentos tables.

  ## Reason
  These fields use a rich text editor (Quill) that produces HTML markup.
  The HTML tags inflate the character count significantly beyond what the user
  actually types, making the limits impractical. Additionally, legal text
  (fundamentação, observações, comentários) can be arbitrarily long by nature.

  ## Constraints Removed

  ### verba_lancamentos
  - `verba_lancamentos_fundamentacao_max_length` (was 10,000 chars)
  - `verba_lancamentos_comentarios_max_length` (was 10,000 chars)

  ### processes
  - `processes_observacoes_max_length` (was 2,000 chars)

  ### decisions
  - `decisions_observacoes_max_length` (was 5,000 chars)

  ### lancamentos_documentos
  - `lancamentos_documentos_comentarios_max_length` (was 5,000 chars)

  ## Fields NOT affected (semantic identifiers — limits kept)
  - `verbas.tipo_verba` max 100 / min 2
  - `decisions.id_decisao` max 50 / min 3
*/

ALTER TABLE public.verba_lancamentos
  DROP CONSTRAINT IF EXISTS verba_lancamentos_fundamentacao_max_length;

ALTER TABLE public.verba_lancamentos
  DROP CONSTRAINT IF EXISTS verba_lancamentos_comentarios_max_length;

ALTER TABLE public.processes
  DROP CONSTRAINT IF EXISTS processes_observacoes_max_length;

ALTER TABLE public.decisions
  DROP CONSTRAINT IF EXISTS decisions_observacoes_max_length;

ALTER TABLE public.lancamentos_documentos
  DROP CONSTRAINT IF EXISTS lancamentos_documentos_comentarios_max_length;
