/*
  # تعطيل RLS على جميع الجداول
  
  1. المشكلة
    - النظام يستخدم Custom Auth وليس Supabase Auth
    - auth.uid() يعود null دائماً
    - RLS يمنع جميع العمليات
  
  2. الحل
    - تعطيل RLS على جميع الجداول مؤقتاً
  
  3. ملاحظة
    - في الإنتاج، يجب استخدام Supabase Auth وتفعيل RLS
*/

-- تعطيل RLS على جميع الجداول
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE demo_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_section_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
