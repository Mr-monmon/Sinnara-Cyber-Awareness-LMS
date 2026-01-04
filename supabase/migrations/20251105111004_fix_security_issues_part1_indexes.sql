/*
  # Fix Security Issues - Part 1: Foreign Key Indexes
  
  1. Performance Improvements
    - Add indexes for all unindexed foreign keys
    - Improves query performance for JOIN operations
    - Covers 19 missing foreign key indexes
  
  2. Tables Affected
    - assigned_exams: 3 indexes
    - audit_logs: 1 index
    - departments: 1 index
    - employee_departments: 1 index
    - employee_section_progress: 1 index
    - exam_attempts: 2 indexes
    - invoices: 1 index
    - issued_certificates: 2 indexes
    - phishing_campaign_requests: 3 indexes
    - phishing_campaign_targets: 1 index
    - phishing_campaigns: 1 index
    - phishing_templates: 1 index
    - subscriptions: 1 index
  
  3. Index Naming Convention
    - Format: idx_<table>_<column>_fkey
    - Makes it clear these support foreign key relationships
*/

-- Add missing foreign key indexes for assigned_exams
CREATE INDEX IF NOT EXISTS idx_assigned_exams_assigned_to_department_fkey 
  ON public.assigned_exams(assigned_to_department) 
  WHERE assigned_to_department IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assigned_exams_assigned_to_employee_fkey 
  ON public.assigned_exams(assigned_to_employee) 
  WHERE assigned_to_employee IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assigned_exams_company_id_fkey 
  ON public.assigned_exams(company_id);

-- Add missing foreign key index for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_fkey 
  ON public.audit_logs(user_id);

-- Add missing foreign key index for departments
CREATE INDEX IF NOT EXISTS idx_departments_company_id_fkey 
  ON public.departments(company_id);

-- Add missing foreign key index for employee_departments
CREATE INDEX IF NOT EXISTS idx_employee_departments_department_id_fkey 
  ON public.employee_departments(department_id);

-- Add missing foreign key index for employee_section_progress
CREATE INDEX IF NOT EXISTS idx_employee_section_progress_section_id_fkey 
  ON public.employee_section_progress(section_id);

-- Add missing foreign key indexes for exam_attempts
CREATE INDEX IF NOT EXISTS idx_exam_attempts_employee_id_fkey 
  ON public.exam_attempts(employee_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id_fkey 
  ON public.exam_attempts(exam_id);

-- Add missing foreign key index for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_company_id_fkey 
  ON public.invoices(company_id);

-- Add missing foreign key indexes for issued_certificates
CREATE INDEX IF NOT EXISTS idx_issued_certificates_course_id_fkey 
  ON public.issued_certificates(course_id) 
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issued_certificates_employee_id_fkey 
  ON public.issued_certificates(employee_id);

-- Add missing foreign key indexes for phishing_campaign_requests
CREATE INDEX IF NOT EXISTS idx_phishing_campaign_requests_approved_by_fkey 
  ON public.phishing_campaign_requests(approved_by) 
  WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_phishing_campaign_requests_requested_by_fkey 
  ON public.phishing_campaign_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_phishing_campaign_requests_template_id_fkey 
  ON public.phishing_campaign_requests(template_id);

-- Add missing foreign key index for phishing_campaign_targets
CREATE INDEX IF NOT EXISTS idx_phishing_campaign_targets_department_id_fkey 
  ON public.phishing_campaign_targets(department_id) 
  WHERE department_id IS NOT NULL;

-- Add missing foreign key index for phishing_campaigns
CREATE INDEX IF NOT EXISTS idx_phishing_campaigns_template_id_fkey 
  ON public.phishing_campaigns(template_id);

-- Add missing foreign key index for phishing_templates
CREATE INDEX IF NOT EXISTS idx_phishing_templates_created_by_fkey 
  ON public.phishing_templates(created_by) 
  WHERE created_by IS NOT NULL;

-- Add missing foreign key index for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id_fkey 
  ON public.subscriptions(company_id);
