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
  passing_score: number;
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
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  department_ids: string[] | null;
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

export interface Company {
  id: string;
  name: string;
  admin_name?: string;
  admin_email?: string;
  subscription_start?: string;
  subscription_end?: string;
  subscription_type?: string;
  is_active?: boolean;
  reminder_sent?: boolean;
  reminder_sent_at?: string;
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
