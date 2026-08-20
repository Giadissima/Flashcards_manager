export interface Test {
  _id?: string;  // id generato da MongoDB
  notes?: string;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  elapsed_time?: number;
  questions: Question[];
}

export type Question = {
  flashcard_id: string;
  is_correct?: boolean;
}

export interface TestStats {
  totalTests: number;
  completedTests: number;
  totalTimeSpentSeconds: number;
  averageScorePercent: number;
}