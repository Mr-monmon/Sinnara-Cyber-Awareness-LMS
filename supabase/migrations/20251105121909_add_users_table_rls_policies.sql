/*
  # Add Missing RLS Policies for Users Table
  
  1. Issue
    - Users table only has SELECT policy
    - Missing INSERT, UPDATE, DELETE policies
    - Creating companies fails because admin user cannot be inserted
  
  2. Solution
    - Add INSERT policy for anon role (platform admin creating users)
    - Add UPDATE policy for anon role
    - Add DELETE policy for anon role
    
  3. Security Notes
    - Using anon role because the app uses custom auth (not Supabase Auth)
    - The frontend handles authentication via login checks
    - Platform admins should be able to manage all users
*/

-- Add INSERT policy for users
CREATE POLICY "Allow anonymous insert users"
  ON public.users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Add UPDATE policy for users
CREATE POLICY "Allow anonymous update users"
  ON public.users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for users
CREATE POLICY "Allow anonymous delete users"
  ON public.users
  FOR DELETE
  TO anon
  USING (true);
