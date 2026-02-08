/*
  # Create PDF Comments System

  1. New Tables
    - `pdf_comments`
      - `id` (uuid, primary key)
      - `process_document_id` (uuid, foreign key to process_documents)
      - `page_number` (integer, page where comment is placed)
      - `content` (text, comment text content)
      - `position_x` (float, x coordinate relative to page)
      - `position_y` (float, y coordinate relative to page)
      - `color` (text, balloon color: yellow, green, blue, pink, purple, orange, red)
      - `is_minimized` (boolean, whether balloon is collapsed)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `pdf_comment_connectors`
      - `id` (uuid, primary key)
      - `comment_id` (uuid, foreign key to pdf_comments)
      - `connector_type` (text: 'arrow' or 'textbox')
      - `start_x`, `start_y` (float, start point coordinates)
      - `end_x`, `end_y` (float, end point coordinates)
      - `control_x`, `control_y` (float, bezier curve control point, nullable)
      - `text_content` (text, for textbox type, nullable)
      - `stroke_color` (text, line color)
      - `stroke_width` (float, line thickness)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for anonymous access (no login system)

  3. Indexes
    - Index on process_document_id and page_number for fast queries
*/

-- Create pdf_comments table
CREATE TABLE IF NOT EXISTS pdf_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_document_id uuid NOT NULL REFERENCES process_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  content text NOT NULL DEFAULT '',
  position_x float NOT NULL,
  position_y float NOT NULL,
  color text NOT NULL DEFAULT 'yellow',
  is_minimized boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_color CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'red')),
  CONSTRAINT valid_page_number CHECK (page_number > 0),
  CONSTRAINT valid_position CHECK (position_x >= 0 AND position_y >= 0)
);

-- Create pdf_comment_connectors table
CREATE TABLE IF NOT EXISTS pdf_comment_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES pdf_comments(id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  start_x float NOT NULL,
  start_y float NOT NULL,
  end_x float NOT NULL,
  end_y float NOT NULL,
  control_x float,
  control_y float,
  text_content text,
  stroke_color text NOT NULL DEFAULT '#374151',
  stroke_width float NOT NULL DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_connector_type CHECK (connector_type IN ('arrow', 'textbox')),
  CONSTRAINT valid_stroke_width CHECK (stroke_width > 0 AND stroke_width <= 10)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_comments_document_page 
  ON pdf_comments(process_document_id, page_number);

CREATE INDEX IF NOT EXISTS idx_pdf_comment_connectors_comment 
  ON pdf_comment_connectors(comment_id);

-- Enable RLS
ALTER TABLE pdf_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_comment_connectors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pdf_comments (anonymous access)
CREATE POLICY "Allow anonymous read pdf_comments"
  ON pdf_comments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert pdf_comments"
  ON pdf_comments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update pdf_comments"
  ON pdf_comments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete pdf_comments"
  ON pdf_comments FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for pdf_comment_connectors (anonymous access)
CREATE POLICY "Allow anonymous read pdf_comment_connectors"
  ON pdf_comment_connectors FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert pdf_comment_connectors"
  ON pdf_comment_connectors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update pdf_comment_connectors"
  ON pdf_comment_connectors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete pdf_comment_connectors"
  ON pdf_comment_connectors FOR DELETE
  TO anon
  USING (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_pdf_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_pdf_comments_updated_at ON pdf_comments;
CREATE TRIGGER trigger_pdf_comments_updated_at
  BEFORE UPDATE ON pdf_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_pdf_comments_updated_at();

DROP TRIGGER IF EXISTS trigger_pdf_comment_connectors_updated_at ON pdf_comment_connectors;
CREATE TRIGGER trigger_pdf_comment_connectors_updated_at
  BEFORE UPDATE ON pdf_comment_connectors
  FOR EACH ROW
  EXECUTE FUNCTION update_pdf_comments_updated_at();