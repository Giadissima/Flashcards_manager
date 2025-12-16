import { Flashcard } from "./flashcard.dto";

export interface Test {
  _id: string;  // id generato da MongoDB
  notes?: string;
  completed_at?: Date;
  elapsed_time?: number;
  questions: Question[];
}

export type Question = {
  flashcard_id: string | Flashcard;
  is_correct?: boolean;
}