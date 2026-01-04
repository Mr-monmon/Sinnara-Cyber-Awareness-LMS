/*
  # Create Partners Table for Homepage
  
  1. New Tables
    - `partners`
      - `id` (uuid, primary key)
      - `name` (text)
      - `logo_url` (text) - URL or path to logo image
      - `website` (text, optional)
      - `order_index` (integer) - for ordering logos
      - `is_active` (boolean) - show/hide partner
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - RLS disabled to match system pattern
*/

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website text,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE partners DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_order ON partners(order_index);
