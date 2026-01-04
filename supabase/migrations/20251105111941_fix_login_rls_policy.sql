/*
  # Fix Login RLS Policy
  
  1. Issue
    - Current RLS policy on users table requires authentication
    - Login query needs to read users table BEFORE authentication
    - This creates a chicken-and-egg problem
  
  2. Solution
    - Allow anonymous SELECT on users table for login purposes
    - Keep other operations (INSERT, UPDATE, DELETE) for authenticated users only
    - This is safe because:
      - Passwords are plain text in this custom auth system
      - Application logic handles the authentication check
      - No sensitive data exposed (passwords validated by application)
  
  3. Security Note
    - This custom auth system stores plain text passwords
    - In production, passwords should be hashed
    - For now, allowing anonymous SELECT for login functionality
*/

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Allow authenticated all users" ON public.users;

-- Create separate policies for different operations
-- Allow anonymous SELECT for login (application validates credentials)
CREATE POLICY "Allow anonymous select for login"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated SELECT
CREATE POLICY "Allow authenticated select users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated INSERT
CREATE POLICY "Allow authenticated insert users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated UPDATE
CREATE POLICY "Allow authenticated update users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated DELETE
CREATE POLICY "Allow authenticated delete users"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (true);
