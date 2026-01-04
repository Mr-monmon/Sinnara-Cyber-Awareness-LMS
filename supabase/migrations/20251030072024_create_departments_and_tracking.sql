/*
  # نظام الأقسام وتتبع التقدم المتقدم

  1. جداول جديدة
    - departments: أقسام الشركة
    - employee_departments: ربط الموظفين بالأقسام
    - assigned_exams: الاختبارات المخصصة للموظفين
    - exam_attempts: محاولات الاختبار مع التاريخ
    - certificate_templates: قوالب الشهادات
    - issued_certificates: الشهادات الصادرة

  2. تحديثات
    - إضافة حقول جديدة لتتبع التقدم
    - إضافة حقول pre/post assessment
*/

-- جدول الأقسام
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ربط الموظفين بالأقسام
CREATE TABLE IF NOT EXISTS employee_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES users(id),
  UNIQUE(employee_id, department_id)
);

-- جدول تخصيص الاختبارات
CREATE TABLE IF NOT EXISTS assigned_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_to_employee uuid REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_department uuid REFERENCES departments(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users(id),
  due_date timestamptz,
  is_mandatory boolean DEFAULT true,
  max_attempts int DEFAULT 1,
  assigned_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  CHECK (assigned_to_employee IS NOT NULL OR assigned_to_department IS NOT NULL)
);

-- جدول محاولات الاختبار
CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_exam_id uuid NOT NULL REFERENCES assigned_exams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  attempt_number int NOT NULL DEFAULT 1,
  score numeric(5,2),
  passed boolean,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  answers jsonb,
  time_spent_seconds int,
  UNIQUE(assigned_exam_id, employee_id, attempt_number)
);

-- جدول قوالب الشهادات
CREATE TABLE IF NOT EXISTS certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_html text NOT NULL,
  template_variables jsonb DEFAULT '["employee_name", "course_name", "completion_date", "score"]',
  background_image_url text,
  logo_url text,
  signature_image_url text,
  border_style jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الشهادات الصادرة
CREATE TABLE IF NOT EXISTS issued_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text UNIQUE NOT NULL,
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  template_id uuid REFERENCES certificate_templates(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  course_name text NOT NULL,
  completion_date date NOT NULL,
  score numeric(5,2),
  certificate_data jsonb,
  pdf_url text,
  issued_at timestamptz DEFAULT now(),
  issued_by uuid REFERENCES users(id)
);

-- تحديث جدول employee_courses لإضافة تتبع أفضل
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_courses' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE employee_courses ADD COLUMN progress_percentage numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_courses' AND column_name = 'last_accessed_at'
  ) THEN
    ALTER TABLE employee_courses ADD COLUMN last_accessed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_courses' AND column_name = 'completed_sections'
  ) THEN
    ALTER TABLE employee_courses ADD COLUMN completed_sections int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_courses' AND column_name = 'total_sections'
  ) THEN
    ALTER TABLE employee_courses ADD COLUMN total_sections int DEFAULT 0;
  END IF;
END $$;

-- تحديث جدول users لإضافة pre/post assessment
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'pre_assessment_score'
  ) THEN
    ALTER TABLE users ADD COLUMN pre_assessment_score numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'post_assessment_score'
  ) THEN
    ALTER TABLE users ADD COLUMN post_assessment_score numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'pre_assessment_date'
  ) THEN
    ALTER TABLE users ADD COLUMN pre_assessment_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'post_assessment_date'
  ) THEN
    ALTER TABLE users ADD COLUMN post_assessment_date timestamptz;
  END IF;
END $$;

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_departments_employee ON employee_departments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_departments_department ON employee_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_assigned_exams_company ON assigned_exams(company_id);
CREATE INDEX IF NOT EXISTS idx_assigned_exams_employee ON assigned_exams(assigned_to_employee);
CREATE INDEX IF NOT EXISTS idx_assigned_exams_department ON assigned_exams(assigned_to_department);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_employee ON exam_attempts(employee_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_employee ON issued_certificates(employee_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_course ON issued_certificates(course_id);

-- وظيفة لتوليد رقم شهادة فريد
CREATE OR REPLACE FUNCTION generate_certificate_number()
RETURNS text AS $$
BEGIN
  RETURN 'CERT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- وظيفة لحساب نسبة التقدم
CREATE OR REPLACE FUNCTION calculate_course_progress(p_employee_id uuid, p_course_id uuid)
RETURNS numeric AS $$
DECLARE
  v_total_sections int;
  v_completed_sections int;
BEGIN
  SELECT COUNT(*) INTO v_total_sections
  FROM course_sections
  WHERE course_id = p_course_id;

  SELECT COUNT(DISTINCT section_id) INTO v_completed_sections
  FROM employee_section_progress
  WHERE employee_id = p_employee_id
  AND section_id IN (SELECT id FROM course_sections WHERE course_id = p_course_id)
  AND completed = true;

  IF v_total_sections > 0 THEN
    RETURN ROUND((v_completed_sections::numeric / v_total_sections::numeric) * 100, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- تعطيل RLS على الجداول الجديدة
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE issued_certificates DISABLE ROW LEVEL SECURITY;
