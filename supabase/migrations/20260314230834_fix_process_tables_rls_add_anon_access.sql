/*
  # Fix Process Tables RLS - Add Anonymous Access

  ## Problem
  The process_tables, process_table_columns, process_table_rows, and process_table_cells
  tables had RLS policies restricted to the `authenticated` role only. However, the app
  runs without user authentication (uses anon key), so all requests come from the `anon`
  role, which was being blocked.

  ## Changes
  - Drop existing `authenticated`-only policies on all 4 tables
  - Recreate all policies with `TO authenticated, anon` to match the pattern used by
    lancamentos_documentos and other tables in this project

  ## Tables Modified
  - process_tables
  - process_table_columns
  - process_table_rows
  - process_table_cells
*/

-- Drop existing authenticated-only policies for process_tables
DROP POLICY IF EXISTS "Authenticated users can view process tables" ON process_tables;
DROP POLICY IF EXISTS "Authenticated users can insert process tables" ON process_tables;
DROP POLICY IF EXISTS "Authenticated users can update process tables" ON process_tables;
DROP POLICY IF EXISTS "Authenticated users can delete process tables" ON process_tables;

-- Drop existing authenticated-only policies for process_table_columns
DROP POLICY IF EXISTS "Authenticated users can view process table columns" ON process_table_columns;
DROP POLICY IF EXISTS "Authenticated users can insert process table columns" ON process_table_columns;
DROP POLICY IF EXISTS "Authenticated users can update process table columns" ON process_table_columns;
DROP POLICY IF EXISTS "Authenticated users can delete process table columns" ON process_table_columns;

-- Drop existing authenticated-only policies for process_table_rows
DROP POLICY IF EXISTS "Authenticated users can view process table rows" ON process_table_rows;
DROP POLICY IF EXISTS "Authenticated users can insert process table rows" ON process_table_rows;
DROP POLICY IF EXISTS "Authenticated users can update process table rows" ON process_table_rows;
DROP POLICY IF EXISTS "Authenticated users can delete process table rows" ON process_table_rows;

-- Drop existing authenticated-only policies for process_table_cells
DROP POLICY IF EXISTS "Authenticated users can view process table cells" ON process_table_cells;
DROP POLICY IF EXISTS "Authenticated users can insert process table cells" ON process_table_cells;
DROP POLICY IF EXISTS "Authenticated users can update process table cells" ON process_table_cells;
DROP POLICY IF EXISTS "Authenticated users can delete process table cells" ON process_table_cells;

-- Recreate policies for process_tables with anon access
CREATE POLICY "Allow view process tables"
  ON process_tables FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow insert process tables"
  ON process_tables FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update process tables"
  ON process_tables FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete process tables"
  ON process_tables FOR DELETE
  TO authenticated, anon
  USING (true);

-- Recreate policies for process_table_columns with anon access
CREATE POLICY "Allow view process table columns"
  ON process_table_columns FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow insert process table columns"
  ON process_table_columns FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update process table columns"
  ON process_table_columns FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete process table columns"
  ON process_table_columns FOR DELETE
  TO authenticated, anon
  USING (true);

-- Recreate policies for process_table_rows with anon access
CREATE POLICY "Allow view process table rows"
  ON process_table_rows FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow insert process table rows"
  ON process_table_rows FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update process table rows"
  ON process_table_rows FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete process table rows"
  ON process_table_rows FOR DELETE
  TO authenticated, anon
  USING (true);

-- Recreate policies for process_table_cells with anon access
CREATE POLICY "Allow view process table cells"
  ON process_table_cells FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow insert process table cells"
  ON process_table_cells FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update process table cells"
  ON process_table_cells FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete process table cells"
  ON process_table_cells FOR DELETE
  TO authenticated, anon
  USING (true);
