/*
  # Add Employee Count to Demo Requests
  
  1. Changes
    - Add employee_count column to demo_requests table
    - Add status column for tracking request status
  
  2. Security
    - RLS disabled to match system pattern
*/

-- Add employee_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'demo_requests' AND column_name = 'employee_count'
  ) THEN
    ALTER TABLE demo_requests ADD COLUMN employee_count integer;
  END IF;
END $$;

-- Add status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'demo_requests' AND column_name = 'status'
  ) THEN
    ALTER TABLE demo_requests ADD COLUMN status text DEFAULT 'PENDING';
  END IF;
END $$;

-- Add notes column for admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'demo_requests' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE demo_requests ADD COLUMN admin_notes text;
  END IF;
END $$;
