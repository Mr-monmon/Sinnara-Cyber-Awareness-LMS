/*
  # Fix Partners Table RLS Policies

  Ensure platform admins can manage partner logos with proper RLS policies.
  
  Changes:
  - Remove overly permissive policies
  - Add explicit PLATFORM_ADMIN policies for all operations
  - Keep public read access for anonymous users
*/

DROP POLICY IF EXISTS "Allow authenticated all partners" ON public.partners;
DROP POLICY IF EXISTS "Allow anonymous read partners" ON public.partners;

CREATE POLICY "Platform admins can manage partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Anonymous can view active partners"
  ON public.partners FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated can view active partners"
  ON public.partners FOR SELECT
  TO authenticated
  USING (is_active = true);
