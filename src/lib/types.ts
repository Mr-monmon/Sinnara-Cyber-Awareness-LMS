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
