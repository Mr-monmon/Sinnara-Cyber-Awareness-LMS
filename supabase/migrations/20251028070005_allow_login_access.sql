/*
  # Allow Login Access

  ## Changes
  - Add policy to allow anonymous users to read from users table for login validation
  
  ## Security Notes
  - This is required for login functionality
  - Only SELECT access is granted
  - Users can only read data, not modify
*/

-- Allow anonymous users to select from users table for login
CREATE POLICY "Allow anonymous login"
  ON users FOR SELECT
  TO anon
  USING (true);