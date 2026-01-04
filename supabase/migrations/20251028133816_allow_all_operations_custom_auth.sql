/*
  # Allow All Operations for Custom Authentication

  ## Changes
  - Update all policies to work with custom authentication (not Supabase Auth)
  - Allow anon and authenticated roles full access
  - Application handles authorization through custom logic
  
  ## Security Notes
  - Since we're using custom auth stored in users table (not Supabase Auth)
  - Application handles all authorization checks
  - RLS is kept enabled but permissive for application-managed access
*/

-- EXAMS
DROP POLICY IF EXISTS "Platform admins can manage all exams" ON exams;
DROP POLICY IF EXISTS "Authenticated users can view exams" ON exams;

CREATE POLICY "Allow all operations on exams"
  ON exams FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- COURSES
DROP POLICY IF EXISTS "Platform admins can manage all courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can view courses" ON courses;

CREATE POLICY "Allow all operations on courses"
  ON courses FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- COMPANIES
DROP POLICY IF EXISTS "Platform admins can do everything with companies" ON companies;
DROP POLICY IF EXISTS "Company admins can view their own company" ON companies;

CREATE POLICY "Allow all operations on companies"
  ON companies FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- EXAM_QUESTIONS
DROP POLICY IF EXISTS "Platform admins can manage exam questions" ON exam_questions;
DROP POLICY IF EXISTS "Authenticated users can view exam questions" ON exam_questions;

CREATE POLICY "Allow all operations on exam_questions"
  ON exam_questions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- COURSE_SECTIONS
DROP POLICY IF EXISTS "Platform admins can manage course sections" ON course_sections;
DROP POLICY IF EXISTS "Authenticated users can view course sections" ON course_sections;

CREATE POLICY "Allow all operations on course_sections"
  ON course_sections FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- COMPANY_COURSES
DROP POLICY IF EXISTS "Platform admins can manage company courses" ON company_courses;
DROP POLICY IF EXISTS "Company admins can view their company courses" ON company_courses;

CREATE POLICY "Allow all operations on company_courses"
  ON company_courses FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- COMPANY_EXAMS
DROP POLICY IF EXISTS "Platform admins can manage company exams" ON company_exams;
DROP POLICY IF EXISTS "Company admins can view their company exams" ON company_exams;

CREATE POLICY "Allow all operations on company_exams"
  ON company_exams FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- EMPLOYEE_COURSES
DROP POLICY IF EXISTS "Users can view their own courses" ON employee_courses;
DROP POLICY IF EXISTS "Company admins can manage employee courses" ON employee_courses;

CREATE POLICY "Allow all operations on employee_courses"
  ON employee_courses FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- EXAM_RESULTS
DROP POLICY IF EXISTS "Users can view their own exam results" ON exam_results;
DROP POLICY IF EXISTS "Company admins can view employee exam results" ON exam_results;

CREATE POLICY "Allow all operations on exam_results"
  ON exam_results FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- PUBLIC_ASSESSMENTS
DROP POLICY IF EXISTS "Anyone can view public assessments" ON public_assessments;
DROP POLICY IF EXISTS "Platform admins can manage public assessments" ON public_assessments;

CREATE POLICY "Allow all operations on public_assessments"
  ON public_assessments FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- DEMO_REQUESTS
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON demo_requests;
DROP POLICY IF EXISTS "Platform admins can view demo requests" ON demo_requests;

CREATE POLICY "Allow all operations on demo_requests"
  ON demo_requests FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- QUIZZES
CREATE POLICY "Allow all operations on quizzes"
  ON quizzes FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);