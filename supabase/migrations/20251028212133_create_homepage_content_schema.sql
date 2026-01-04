/*
  # إنشاء جداول إدارة محتوى الصفحة الرئيسية

  1. جداول جديدة
    - homepage_hero: محتوى Hero Section
    - homepage_features: بطاقات الميزات
    - homepage_partners: شركاء النجاح
    - homepage_steps: خطوات How It Works
    - homepage_settings: إعدادات عامة (CTA, Footer)

  2. الأمان
    - تفعيل RLS على جميع الجداول (معطل مؤقتاً للتطوير)
    - Platform Admin: صلاحيات كاملة
    - الجميع: قراءة فقط

  3. الفهارس
    - فهرسة order_index للترتيب
    - فهرسة is_active للتصفية
*/

-- جدول Hero Section
CREATE TABLE IF NOT EXISTS homepage_hero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL DEFAULT 'Protect Your Company by Empowering Your People.',
  subheadline text NOT NULL DEFAULT 'Sinnara is your comprehensive cybersecurity platform',
  primary_button_text text DEFAULT 'Request Demo',
  secondary_button_text text DEFAULT 'Login',
  background_gradient jsonb DEFAULT '{"from": "#1e40af", "to": "#7c3aed"}',
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- جدول Features
CREATE TABLE IF NOT EXISTS homepage_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT 'Shield',
  order_index int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول Partners
CREATE TABLE IF NOT EXISTS homepage_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  order_index int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول How It Works Steps
CREATE TABLE IF NOT EXISTS homepage_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT 'CheckCircle',
  order_index int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول Settings
CREATE TABLE IF NOT EXISTS homepage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- إدراج بيانات Hero الافتراضية
INSERT INTO homepage_hero (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- إدراج Features الافتراضية
INSERT INTO homepage_features (title, description, icon, order_index) VALUES
  ('Hosted in Saudi Arabia', 'Your data stays secure with local hosting in Saudi data centers, ensuring compliance with national standards.', 'Server', 1),
  ('Compliant with Regulations', 'Fully aligned with ISO 27001, NCA, SAMA, and PDPL requirements.', 'ShieldCheck', 2),
  ('Multi-tenant Architecture', 'Manage multiple companies with isolated data, flexible packages, and centralized control.', 'Building2', 3),
  ('Comprehensive Training', 'Interactive courses with videos, slides, and quizzes designed to strengthen cybersecurity awareness.', 'GraduationCap', 4),
  ('Pre & Post Assessments', 'Measure improvement with before-and-after awareness tests.', 'ClipboardCheck', 5),
  ('Real-Time Analytics', 'Monitor progress and performance across departments with live dashboards.', 'BarChart3', 6),
  ('Role-Based Access', 'Granular permissions for Platform Admins, Company Admins, and Employees.', 'Users', 7),
  ('Phishing Simulation', 'Simulate realistic phishing campaigns to test employee readiness. (Coming Soon)', 'Mail', 8)
ON CONFLICT DO NOTHING;

-- إدراج How It Works Steps
INSERT INTO homepage_steps (title, description, icon, order_index) VALUES
  ('Onboard Employees', 'Company Admins upload employee data via Excel or manual entry. The system auto-generates login credentials.', 'UserPlus', 1),
  ('Pre-Assessment', 'Employees complete an initial awareness test to evaluate their current knowledge.', 'ClipboardList', 2),
  ('Complete Training', 'Employees access assigned courses or attend workshops to improve awareness.', 'BookOpen', 3),
  ('Post-Assessment & Certificate', 'After completing the program, employees retake the test and receive a digital certificate.', 'Award', 4)
ON CONFLICT DO NOTHING;

-- إدراج Settings الافتراضية
INSERT INTO homepage_settings (setting_key, setting_value) VALUES
  ('cta_section', '{"headline": "Ready to Secure Your Organization?", "subheadline": "Start building a culture of cybersecurity awareness today.", "primary_button": "Request a Demo", "secondary_button": "Free Assessment"}'),
  ('footer', '{"tagline": "Sinnara — empowering organizations through cybersecurity awareness.", "email": "info@sinnara.com", "phone": "+966 XX XXX XXXX", "copyright": "© 2025 Sinnara. All rights reserved."}'),
  ('features_section', '{"title": "Everything You Need for Cyber Awareness", "subtitle": "Comprehensive tools to build and maintain a security-conscious workforce."}'),
  ('partners_section', '{"title": "Our Success Partners", "subtitle": "Trusted by organizations that value cybersecurity."}'),
  ('steps_section', '{"title": "How Sinnara Works", "subtitle": ""}')
ON CONFLICT (setting_key) DO NOTHING;

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_features_order ON homepage_features(order_index);
CREATE INDEX IF NOT EXISTS idx_features_active ON homepage_features(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_order ON homepage_partners(order_index);
CREATE INDEX IF NOT EXISTS idx_partners_active ON homepage_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_steps_order ON homepage_steps(order_index);
CREATE INDEX IF NOT EXISTS idx_steps_active ON homepage_steps(is_active);

-- تعطيل RLS مؤقتاً للتطوير
ALTER TABLE homepage_hero DISABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_features DISABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_settings DISABLE ROW LEVEL SECURITY;
