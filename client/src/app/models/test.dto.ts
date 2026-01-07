import { Flashcard } from "./flashcard.dto";

export interface Test {
  _id?: string;  // id generato da MongoDB
  notes?: string;
  completedAt?: Date;
  createdAt?: Date;
  elapsed_time?: number;
  questions: Question[];
}

export type Question = {
  flashcard_id: string;
  is_correct?: boolean;
}