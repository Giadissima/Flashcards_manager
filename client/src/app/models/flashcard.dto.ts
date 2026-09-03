import { Subject } from "./subject.dto";
import { Topic } from "./topic.dto";

export interface Flashcard {
  _id: string;  // id generato da MongoDB

  title: string;
  question: string;
  answer: string;

  topic_id?: string | Topic; // populated by the server, a plain id on the way back
  subject_id?: string | Subject; // populated by the server, a plain id on the way back
}

/** One of the flashcards drawn for a new test, with the topic it is on. */
export interface RandomFlashcard {
  _id: string;
  topic_id: string;
}
