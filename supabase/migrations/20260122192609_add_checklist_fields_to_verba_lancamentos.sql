/*
  # Add Checklist Fields to Verba Lancamentos

  1. New Columns
    - `check_calculista` (boolean, default false) - Marks when calculation is complete
    - `check_calculista_at` (timestamptz, nullable) - Timestamp when calculista check was marked
    - `check_revisor` (boolean, default false) - Marks when review is approved
    - `check_revisor_at` (timestamptz, nullable) - Timestamp when revisor check was marked

  2. Constraints
    - Constraint to ensure revisor check can only be true if calculista check is true

  3. Indexes
    - Index on check_calculista for filtering
    - Index on check_revisor for filtering
*/

-- Add checklist columns to verba_lancamentos
ALTER TABLE verba_lancamentos
ADD COLUMN IF NOT EXISTS check_calculista boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS check_calculista_at timestamptz,
ADD COLUMN IF NOT EXISTS check_revisor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS check_revisor_at timestamptz;

-- Add constraint: revisor can only check if calculista has checked
ALTER TABLE verba_lancamentos
DROP CONSTRAINT IF EXISTS check_revisor_requires_calculista;

ALTER TABLE verba_lancamentos
ADD CONSTRAINT check_revisor_requires_calculista
CHECK (
  (check_revisor = false) OR (check_calculista = true AND check_revisor = true)
);

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_verba_lancamentos_check_calculista
ON verba_lancamentos(check_calculista);

CREATE INDEX IF NOT EXISTS idx_verba_lancamentos_check_revisor
ON verba_lancamentos(check_revisor);

-- Add comments for documentation
COMMENT ON COLUMN verba_lancamentos.check_calculista IS 'Indicates if the calculation step is complete. Must be true before check_revisor can be true.';
COMMENT ON COLUMN verba_lancamentos.check_calculista_at IS 'Timestamp when the calculista check was marked. NULL if not checked.';
COMMENT ON COLUMN verba_lancamentos.check_revisor IS 'Indicates if the review step is complete. Requires check_calculista to be true.';
COMMENT ON COLUMN verba_lancamentos.check_revisor_at IS 'Timestamp when the revisor check was marked. NULL if not checked.';