/*
  # Add Department ID Reference to Users
  
  1. Changes
    - Add department_id column as UUID reference to departments table
    - Keep old department TEXT column for backwards compatibility
    - Update existing employees to match departments by name
  
  2. Security
    - RLS disabled to match system pattern
*/

-- Add department_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE users ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Try to migrate existing department TEXT values to department_id
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE u.department = d.name
  AND u.department_id IS NULL
  AND u.department IS NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
