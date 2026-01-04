/*
  # Add Company Content Assignment Tables

  ## New Tables
  
  ### 1. `company_courses`
  Link companies to their assigned courses
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `course_id` (uuid, foreign key to courses)
  - `assigned_at` (timestamptz)
  
  ### 2. `company_exams`
  Link companies to their assigned exams
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `exam_id` (uuid, foreign key to exams)
  - `assigned_at` (timestamptz)
  
  ### 3. `course_sections`
  Manage course sections (videos, articles, quizzes)
  - `id` (uuid, primary key)
  - `course_id` (uuid, foreign key to courses)
  - `title` (text)
  - `section_type` (text) - 'VIDEO', 'ARTICLE', 'QUIZ'
  - `content` (text) - URL for video or article content
  - `content_data` (jsonb) - Additional data like quiz questions
  - `duration_minutes` (integer)
  - `order_index` (integer)
  
  ## Security
  - Enable RLS on all new tables
  - Appropriate policies for each role
*/

-- Create company_courses table
CREATE TABLE IF NOT EXISTS company_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(company_id, course_id)
);

-- Create company_exams table
CREATE TABLE IF NOT EXISTS company_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(company_id, exam_id)
);

-- Create course_sections table
CREATE TABLE IF NOT EXISTS course_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  section_type text NOT NULL CHECK (section_type IN ('VIDEO', 'ARTICLE', 'QUIZ')),
  content text,
  content_data jsonb DEFAULT '{}',
  duration_minutes integer DEFAULT 10,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;

-- Policies for company_courses
CREATE POLICY "Platform admins can manage company courses"
  ON company_courses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "Company admins can view their company courses"
  ON company_courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.company_id = company_courses.company_id
    )
  );

-- Policies for company_exams
CREATE POLICY "Platform admins can manage company exams"
  ON company_exams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "Company admins can view their company exams"
  ON company_exams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.company_id = company_exams.company_id
    )
  );

-- Policies for course_sections
CREATE POLICY "Platform admins can manage course sections"
  ON course_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "Authenticated users can view course sections"
  ON course_sections FOR SELECT
  TO authenticated
  USING (true);