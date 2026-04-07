/*
  # App Settings Table + Upload Limit 500MB

  1. New Tables
    - `app_settings`
      - `key` (text, primary key) - setting identifier
      - `value` (text, not null) - setting value as text
      - `description` (text) - human-readable description
      - `updated_at` (timestamptz) - last update timestamp

  2. Default Data
    - Inserts `upload_limit_mb = 500` as default upload limit setting

  3. Storage & Constraints
    - Updates storage bucket `process-documents` file_size_limit to 500MB (524288000 bytes)
    - Replaces `valid_file_size` CHECK constraint with a generous 1GB ceiling;
      actual limit is enforced dynamically via app_settings + storage bucket

  4. RPC Function
    - `update_upload_limit_setting(limit_mb integer)`: atomically updates both
      `app_settings` and `storage.buckets` when the user changes the upload limit

  5. Security
    - RLS enabled on `app_settings`
    - Anon users can SELECT (read settings for validation)
    - Only authenticated users can UPDATE settings
*/

-- ============================================================
-- 1. Create app_settings table
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert app settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 2. Seed default upload limit
-- ============================================================
INSERT INTO app_settings (key, value, description)
VALUES (
  'upload_limit_mb',
  '500',
  'Tamanho máximo permitido para upload de arquivos PDF (em MB)'
)
ON CONFLICT (key) DO UPDATE
  SET value = '500',
      updated_at = now()
  WHERE EXCLUDED.value::integer > app_settings.value::integer;

-- ============================================================
-- 3. Update storage bucket to 500MB
-- ============================================================
UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'process-documents';

-- ============================================================
-- 4. Relax the DB CHECK constraint to a generous 1GB ceiling
--    so the dynamic limit (app_settings + bucket) can vary freely
-- ============================================================
ALTER TABLE process_documents
DROP CONSTRAINT IF EXISTS valid_file_size;

ALTER TABLE process_documents
ADD CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 1073741824);

-- ============================================================
-- 5. RPC: atomically update upload limit in settings + bucket
-- ============================================================
CREATE OR REPLACE FUNCTION update_upload_limit_setting(limit_mb integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  limit_bytes bigint;
BEGIN
  IF limit_mb < 1 OR limit_mb > 1024 THEN
    RAISE EXCEPTION 'limit_mb must be between 1 and 1024';
  END IF;

  limit_bytes := limit_mb::bigint * 1048576;

  INSERT INTO app_settings (key, value, description, updated_at)
  VALUES (
    'upload_limit_mb',
    limit_mb::text,
    'Tamanho máximo permitido para upload de arquivos PDF (em MB)',
    now()
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();

  UPDATE storage.buckets
  SET file_size_limit = limit_bytes
  WHERE id = 'process-documents';

  RETURN jsonb_build_object(
    'success', true,
    'limit_mb', limit_mb,
    'limit_bytes', limit_bytes
  );
END;
$$;
