/*
  # Create process_table_aggregate_rows table

  ## Summary
  Adds a table to store user-defined aggregate (summary) rows that appear pinned
  at the bottom of the ProcessTable viewer. Each aggregate row defines one
  mathematical operation (e.g. SUM, AVERAGE, MIN, MAX) for a specific column,
  optionally scoped to a row-index range instead of the full column.

  ## New Table: process_table_aggregate_rows
  - `id` (uuid, primary key)
  - `table_id` (uuid, FK → process_tables.id, cascade delete)
  - `column_id` (uuid, FK → process_table_columns.id, cascade delete)
  - `operation` (text) – one of: sum, average, min, max, count, product, median, stddev
  - `range_start` (integer, nullable) – first row index to include (1-based); NULL = all rows
  - `range_end` (integer, nullable) – last row index to include (1-based); NULL = all rows
  - `display_order` (integer, default 0) – controls which aggregate row appears first in tfoot
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled, anonymous read and write allowed (matches the rest of the
    process_tables system which also grants anon access)
*/

CREATE TABLE IF NOT EXISTS process_table_aggregate_rows (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       uuid NOT NULL REFERENCES process_tables(id) ON DELETE CASCADE,
  column_id      uuid NOT NULL REFERENCES process_table_columns(id) ON DELETE CASCADE,
  operation      text NOT NULL CHECK (operation IN ('sum','average','min','max','count','product','median','stddev')),
  range_start    integer,
  range_end      integer,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE process_table_aggregate_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select aggregate rows"
  ON process_table_aggregate_rows
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert aggregate rows"
  ON process_table_aggregate_rows
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update aggregate rows"
  ON process_table_aggregate_rows
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete aggregate rows"
  ON process_table_aggregate_rows
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_aggregate_rows_table_id
  ON process_table_aggregate_rows (table_id);
