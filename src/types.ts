export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface ExamData {
  questions: Question[];
}

export interface Exam {
  id?: string;
  adminId: string;
  createdAt: string;
  data: string; // JSON stringified ExamData
  title: string;
  examType: string;
}

export interface Result {
  id?: string;
  examId: string;
  name: string;
  className: string;
  score: number;
  correctP1: number;
  correctP2: number;
  correctP3: number;
  date: string;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  examType: string;
}
