/*
  # Add Status Verbas to Processes

  1. New Column
    - `status_verbas` (text) - Overall status of verbas in the process
      - 'pendente': No lancamentos have any checks
      - 'em_andamento': Some lancamentos have partial checks
      - 'concluido': All lancamentos have both checks complete

  2. Default Value
    - Defaults to 'pendente' for new processes

  3. Index
    - Index on status_verbas for efficient filtering
*/

-- Add status_verbas column to processes
ALTER TABLE processes
ADD COLUMN IF NOT EXISTS status_verbas text DEFAULT 'pendente';

-- Add check constraint for valid values
ALTER TABLE processes
DROP CONSTRAINT IF EXISTS valid_status_verbas;

ALTER TABLE processes
ADD CONSTRAINT valid_status_verbas
CHECK (status_verbas IN ('pendente', 'em_andamento', 'concluido'));

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_processes_status_verbas
ON processes(status_verbas);

-- Add comment for documentation
COMMENT ON COLUMN processes.status_verbas IS 'Overall status of verbas checklist: pendente (no checks), em_andamento (partial checks), concluido (all reviewed)';