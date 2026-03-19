/*
  # AwareOne Cybersecurity Training Platform - Database Schema

  ## Overview
  Multi-tenant cybersecurity awareness training platform with role-based access control.

  ## New Tables

  ### 1. `companies`
  Stores company/organization information
  - `id` (uuid, primary key)
  - `name` (text) - Company name
  - `package_type` (text) - 'TYPE_A' (Full Courses) or 'TYPE_B' (Exam Only)
  - `license_limit` (integer) - Maximum number of employees allowed
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `users`
  Stores all user accounts (Platform Admin, Company Admin, Employee)
  - `id` (uuid, primary key)
  - `email` (text, unique)
  - `password` (text) - Hashed password
  - `full_name` (text)
  - `phone` (text, optional)
  - `employee_id` (text, optional) - For employees
  - `role` (text) - 'PLATFORM_ADMIN', 'COMPANY_ADMIN', 'EMPLOYEE'
  - `company_id` (uuid, foreign key) - NULL for Platform Admins
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `public_assessments`
  Stores public visitor test submissions
  - `id` (uuid, primary key)
  - `full_name` (text)
  - `email` (text)
  - `phone` (text, optional)
  - `company_name` (text, optional)
  - `job_title` (text, optional)
  - `score` (integer) - Number correct
  - `total_questions` (integer)
  - `answers` (jsonb) - Array of question/answer pairs
  - `completed_at` (timestamptz)

  ### 4. `courses`
  Training course library
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `content_type` (text) - 'VIDEO', 'SLIDES', 'TEXT'
  - `content_url` (text, optional)
  - `content_data` (jsonb, optional) - For embedded content
  - `duration_minutes` (integer)
  - `order_index` (integer) - Display order
  - `created_at` (timestamptz)

  ### 5. `quizzes`
  Quiz questions within courses
  - `id` (uuid, primary key)
  - `course_id` (uuid, foreign key)
  - `question` (text)
  - `options` (jsonb) - Array of answer options
  - `correct_answer` (text)
  - `explanation` (text, optional)
  - `order_index` (integer)

  ### 6. `exams`
  Assessment templates (pre-test, post-test)
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `exam_type` (text) - 'PRE_ASSESSMENT', 'POST_ASSESSMENT', 'GENERAL'
  - `passing_score` (integer) - Percentage required to pass
  - `time_limit_minutes` (integer, optional)
  - `created_at` (timestamptz)

  ### 7. `exam_questions`
  Questions in each exam
  - `id` (uuid, primary key)
  - `exam_id` (uuid, foreign key)
  - `question` (text)
  - `options` (jsonb) - Array of answer options
  - `correct_answer` (text)
  - `explanation` (text, optional)
  - `order_index` (integer)

  ### 8. `employee_courses`
  Tracks course assignments and progress
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key)
  - `course_id` (uuid, foreign key)
  - `assigned_at` (timestamptz)
  - `started_at` (timestamptz, optional)
  - `completed_at` (timestamptz, optional)
  - `status` (text) - 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'

  ### 9. `exam_results`
  Stores exam attempts and results
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key)
  - `exam_id` (uuid, foreign key)
  - `score` (integer) - Number correct
  - `total_questions` (integer)
  - `percentage` (numeric)
  - `passed` (boolean)
  - `answers` (jsonb) - Array of question/answer pairs
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `certificate_url` (text, optional)

  ### 10. `demo_requests`
  Stores demo requests from landing page
  - `id` (uuid, primary key)
  - `full_name` (text)
  - `email` (text)
  - `phone` (text, optional)
  - `company_name` (text, optional)
  - `message` (text, optional)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Platform Admins can access all data
  - Company Admins can only access data for their company
  - Employees can only access their own data
  - Public assessments and demo requests are insertable by anyone
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  package_type text NOT NULL CHECK (package_type IN ('TYPE_A', 'TYPE_B')),
  license_limit integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  phone text,
  employee_id text,
  role text NOT NULL CHECK (role IN ('PLATFORM_ADMIN', 'COMPANY_ADMIN', 'EMPLOYEE')),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create public_assessments table
CREATE TABLE IF NOT EXISTS public_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  job_title text,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]',
  completed_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('VIDEO', 'SLIDES', 'TEXT')),
  content_url text,
  content_data jsonb,
  duration_minutes integer DEFAULT 30,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_answer text NOT NULL,
  explanation text,
  order_index integer DEFAULT 0
);

-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  exam_type text NOT NULL CHECK (exam_type IN ('PRE_ASSESSMENT', 'POST_ASSESSMENT', 'GENERAL')),
  passing_score integer DEFAULT 70,
  time_limit_minutes integer,
  created_at timestamptz DEFAULT now()
);

-- Create exam_questions table
CREATE TABLE IF NOT EXISTS exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_answer text NOT NULL,
  explanation text,
  order_index integer DEFAULT 0
);

-- Create employee_courses table
CREATE TABLE IF NOT EXISTS employee_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')),
  UNIQUE(employee_id, course_id)
);

-- Create exam_results table
CREATE TABLE IF NOT EXISTS exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  percentage numeric NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT now(),
  certificate_url text
);

-- Create demo_requests table
CREATE TABLE IF NOT EXISTS demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  message text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Platform admins can do everything with companies"
  ON companies FOR ALL
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

CREATE POLICY "Company admins can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.company_id = companies.id
      AND users.role = 'COMPANY_ADMIN'
    )
  );

-- RLS Policies for users
CREATE POLICY "Platform admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "Company admins can manage users in their company"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'COMPANY_ADMIN'
      AND u.company_id = users.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'COMPANY_ADMIN'
      AND u.company_id = users.company_id
    )
  );

CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for public_assessments
CREATE POLICY "Anyone can insert public assessments"
  ON public_assessments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Platform admins can view all public assessments"
  ON public_assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

-- RLS Policies for courses
CREATE POLICY "Platform admins can manage all courses"
  ON courses FOR ALL
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

CREATE POLICY "Authenticated users can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for quizzes
CREATE POLICY "Platform admins can manage all quizzes"
  ON quizzes FOR ALL
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

CREATE POLICY "Authenticated users can view quizzes"
  ON quizzes FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for exams
CREATE POLICY "Platform admins can manage all exams"
  ON exams FOR ALL
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

CREATE POLICY "Authenticated users can view exams"
  ON exams FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for exam_questions
CREATE POLICY "Platform admins can manage exam questions"
  ON exam_questions FOR ALL
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

CREATE POLICY "Authenticated users can view exam questions"
  ON exam_questions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for employee_courses
CREATE POLICY "Employees can view their assigned courses"
  ON employee_courses FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can update their course progress"
  ON employee_courses FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Company admins can manage courses for their employees"
  ON employee_courses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'COMPANY_ADMIN'
      AND EXISTS (
        SELECT 1 FROM users e
        WHERE e.id = employee_courses.employee_id
        AND e.company_id = u.company_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'COMPANY_ADMIN'
      AND EXISTS (
        SELECT 1 FROM users e
        WHERE e.id = employee_courses.employee_id
        AND e.company_id = u.company_id
      )
    )
  );

-- RLS Policies for exam_results
CREATE POLICY "Employees can view their own results"
  ON exam_results FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert their own results"
  ON exam_results FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Company admins can view results for their employees"
  ON exam_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'COMPANY_ADMIN'
      AND EXISTS (
        SELECT 1 FROM users e
        WHERE e.id = exam_results.employee_id
        AND e.company_id = u.company_id
      )
    )
  );

CREATE POLICY "Platform admins can view all results"
  ON exam_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

-- RLS Policies for demo_requests
CREATE POLICY "Anyone can submit demo requests"
  ON demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Platform admins can view demo requests"
  ON demo_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );
