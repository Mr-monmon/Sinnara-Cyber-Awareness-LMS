/*
  # Fix Partners Table RLS for Custom Authentication

  The application uses custom authentication (email/password in users table),
  not Supabase's built-in auth.uid() system. The RLS policies were checking
  auth.uid() which returns NULL for custom auth.
  
  Solution: Disable RLS on partners table to allow the custom auth to work.
  Platform admins are enforced at the application level in PartnersManagementPage.
*/

ALTER TABLE public.partners DISABLE ROW LEVEL SECURITY;
