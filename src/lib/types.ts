export interface ExamQuestion {
  id: string;
  exam_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  order_index: number;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  exam_type: 'PRE_ASSESSMENT' | 'POST_ASSESSMENT' | 'GENERAL';
  passing_score: number;
  time_limit_minutes: number | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  employee_id?: string;
  role: "PLATFORM_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
  company_id?: string;
  department?: string;
  policy_accepted?: boolean;
  policy_accepted_at?: string;
  created_at: string;
  department_id?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  department_ids: string[] | null;
  content_type: 'VIDEO' | 'SLIDES' | 'TEXT';
  content_url: string | null;
  duration_minutes: number;
  order_index: number;
  created_at: string;
  certificate_id: string | null;
  certificate_templates:{
    id: string;
    name: string;
  }
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  section_type: "VIDEO" | "ARTICLE" | "QUIZ";
  content: string;
  content_data: any;
  duration_minutes: number;
  order_index: number;
  created_at: string;
}

export interface EmployeeCourse {
  id: string;
  employee_id: string;
  course_id: string;
  progress_percentage: number;
  status: string;
  assigned_at: string;
  completed_at: string | null;
}

export interface PhishingCampaignRequest {
  id: string;
  admin_notes: string;
  approved_at: Date;
  campaign_name: string;
  capture_credentials: boolean;
  capture_passwords: boolean;
  company_id: string;
  created_at: Date;
  email_html_body: string;
  email_subject: string;
  email_text_body: string | null;
  from_address: string;
  from_name: string;
  notes: string;
  priority: string;
  rejected_reason: string | null;
  scheduled_date: Date | null;
  status: string;
  track_opens: boolean;
  track_clicks: boolean;
  updated_at: Date;
  ticket_number: string;
  template_id: string;
  target_employee_count: number;
  target_departments: string[];
  approved_by: string | null;
  redirect_url: string | null;
  requested_by: string;
  landing_page_html: string | null;
}

export interface RequestWithCompany extends PhishingCampaignRequest {
  companies?: { name: string };
  users?: { full_name: string };
  phishing_templates?: { name: string };
}

export interface PhishingCampaign {
  id: string;
  campaign_name: string;
  status: string;
  launch_date: string;
  total_targets: number;
  emails_sent: number;
  open_rate: number;
  click_rate: number;
  credential_rate: number;
  reporting_rate: number;
  emails_opened: number;
  links_clicked: number;
  credentials_entered: number;
  emails_reported: number;
  completion_date: string;
}

export interface PhishingCampaignQuota {
  id: string;
  annual_quota: number;
  used_campaigns: number;
}

export interface Company {
  id: string;
  name: string;
  subdomain: string;
  admin_name?: string;
  admin_email?: string;
  subscription_start?: string;
  subscription_end?: string;
  subscription_type?: string;
  is_active?: boolean;
  reminder_sent?: boolean;
  reminder_sent_at?: string;
  package_type?: string;
  license_limit?: number;
  created_at?: Date;
}

export interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
}

export interface PublicAssessment {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  score: number;
  total_questions: number;
  answers: Record<string, string>;
  completed_at: string;
}

export interface Employee {
  id: string;
  full_name: string;
  email: string;
  department_id?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  parent_department_id: string | null;
  employee_count?: number;
  users?: Employee[];
}

export interface PhishingTemplate {
  id: string;
  subject: string;
  html_content: string;
  name: string;
  difficulty_level: string;
  category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAvailableExam {
  employee_id: string;
  exam_id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  passing_score: number;
  exam_type: string;
  max_attempts: number;
  attempts_used: number;
  has_passed: boolean;
  is_mandatory: boolean;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  template_html: string;
  background_image_url: string | null;
  logo_url: string | null;
  signature_image_url: string | null;
  created_at: string;
}