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
