/*
  # Create Process Tables System

  ## Overview
  This migration creates a complete spreadsheet/table import system linked to processes.
  Users can import Excel (.xlsx) or CSV files, which are stored cell-by-cell for granular editing.

  ## New Tables

  ### 1. process_tables
  - Main metadata table for each imported spreadsheet
  - Linked to a specific process via process_id
  - Stores table name, total rows/columns count

  ### 2. process_table_columns
  - Stores column definitions for each table
  - Each column gets an auto-assigned reference letter (A, B, C... Z, AA, AB...)
  - Supports two types: 'data' (raw imported data) and 'formula' (calculated column)
  - Formula columns store the expression (e.g., "C-D" or "(C+D)*2") - computed at runtime

  ### 3. process_table_rows
  - Stores each row as a record with its row index (1-based)
  - Separating rows enables efficient row-level operations

  ### 4. process_table_cells
  - Stores individual cell values
  - References both column and row for precise cell addressing (e.g., "D5")
  - Allows granular editing of any cell value

  ## Security
  - RLS enabled on all 4 tables
  - Authenticated users can read, insert, update, and delete all records
  - Policies are permissive for authenticated users (no process-level ownership since
    the app currently doesn't use user auth - all data is shared)

  ## Important Notes
  1. Cells for formula columns are NOT stored - values are computed on the frontend
  2. Column letters are assigned sequentially: A-Z, then AA-AZ, BA-BZ, etc.
  3. Row index is 1-based (row 1 = first data row after headers)
  4. column_index and row_index enable correct ordering
*/

CREATE TABLE IF NOT EXISTS process_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  total_rows integer NOT NULL DEFAULT 0,
  total_columns integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS process_table_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES process_tables(id) ON DELETE CASCADE,
  column_letter text NOT NULL,
  column_index integer NOT NULL,
  header_name text NOT NULL DEFAULT '',
  column_type text NOT NULL DEFAULT 'data' CHECK (column_type IN ('data', 'formula')),
  formula_expression text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (table_id, column_letter),
  UNIQUE (table_id, column_index)
);

CREATE TABLE IF NOT EXISTS process_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES process_tables(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (table_id, row_index)
);

CREATE TABLE IF NOT EXISTS process_table_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES process_table_rows(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES process_table_columns(id) ON DELETE CASCADE,
  cell_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (row_id, column_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_process_tables_process_id ON process_tables(process_id);
CREATE INDEX IF NOT EXISTS idx_process_table_columns_table_id ON process_table_columns(table_id);
CREATE INDEX IF NOT EXISTS idx_process_table_columns_letter ON process_table_columns(table_id, column_letter);
CREATE INDEX IF NOT EXISTS idx_process_table_rows_table_id ON process_table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_process_table_rows_index ON process_table_rows(table_id, row_index);
CREATE INDEX IF NOT EXISTS idx_process_table_cells_row_id ON process_table_cells(row_id);
CREATE INDEX IF NOT EXISTS idx_process_table_cells_column_id ON process_table_cells(column_id);

-- Enable RLS
ALTER TABLE process_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_table_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_table_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_table_cells ENABLE ROW LEVEL SECURITY;

-- RLS Policies for process_tables
CREATE POLICY "Authenticated users can view process tables"
  ON process_tables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert process tables"
  ON process_tables FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update process tables"
  ON process_tables FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete process tables"
  ON process_tables FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for process_table_columns
CREATE POLICY "Authenticated users can view process table columns"
  ON process_table_columns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert process table columns"
  ON process_table_columns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update process table columns"
  ON process_table_columns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete process table columns"
  ON process_table_columns FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for process_table_rows
CREATE POLICY "Authenticated users can view process table rows"
  ON process_table_rows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert process table rows"
  ON process_table_rows FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update process table rows"
  ON process_table_rows FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete process table rows"
  ON process_table_rows FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for process_table_cells
CREATE POLICY "Authenticated users can view process table cells"
  ON process_table_cells FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert process table cells"
  ON process_table_cells FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update process table cells"
  ON process_table_cells FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete process table cells"
  ON process_table_cells FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_process_tables_updated_at') THEN
    CREATE TRIGGER update_process_tables_updated_at
      BEFORE UPDATE ON process_tables
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_process_table_columns_updated_at') THEN
    CREATE TRIGGER update_process_table_columns_updated_at
      BEFORE UPDATE ON process_table_columns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_process_table_cells_updated_at') THEN
    CREATE TRIGGER update_process_table_cells_updated_at
      BEFORE UPDATE ON process_table_cells
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
