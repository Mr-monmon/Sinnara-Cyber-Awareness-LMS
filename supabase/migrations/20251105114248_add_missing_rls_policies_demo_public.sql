/*
  # Add Missing RLS Policies for Demo Requests and Public Assessments
  
  1. Issue
    - demo_requests table only has INSERT policy, missing SELECT
    - public_assessments missing UPDATE/DELETE policies
    - Admin pages cannot read the data
  
  2. Solution
    - Add SELECT policy for demo_requests (anon role)
    - Add UPDATE, DELETE policies for public_assessments (anon role)
    - Add UPDATE, DELETE policies for demo_requests (anon role)
*/

-- Add SELECT policy for demo_requests
CREATE POLICY "Allow anonymous select demo_requests"
  ON public.demo_requests
  FOR SELECT
  TO anon
  USING (true);

-- Add UPDATE policy for demo_requests
CREATE POLICY "Allow anonymous update demo_requests"
  ON public.demo_requests
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for demo_requests
CREATE POLICY "Allow anonymous delete demo_requests"
  ON public.demo_requests
  FOR DELETE
  TO anon
  USING (true);

-- Add UPDATE policy for public_assessments
CREATE POLICY "Allow anonymous update public_assessments"
  ON public.public_assessments
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for public_assessments
CREATE POLICY "Allow anonymous delete public_assessments"
  ON public.public_assessments
  FOR DELETE
  TO anon
  USING (true);
