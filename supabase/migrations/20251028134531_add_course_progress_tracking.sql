/*
  # Add Course Progress Tracking

  ## New Tables
  
  ### `employee_section_progress`
  Track employee progress through course sections
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `course_id` (uuid, foreign key to courses)
  - `section_id` (uuid, foreign key to course_sections)
  - `completed` (boolean)
  - `completed_at` (timestamptz)
  - `time_spent_minutes` (integer)
  - `created_at` (timestamptz)
  
  ## Security
  - Enable RLS with permissive policies for custom auth
*/

CREATE TABLE IF NOT EXISTS employee_section_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  section_id uuid REFERENCES course_sections(id) ON DELETE CASCADE NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  time_spent_minutes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, section_id)
);

ALTER TABLE employee_section_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on employee_section_progress"
  ON employee_section_progress FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_employee_section_progress_user 
  ON employee_section_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_employee_section_progress_course 
  ON employee_section_progress(course_id);

CREATE INDEX IF NOT EXISTS idx_employee_section_progress_section 
  ON employee_section_progress(section_id);