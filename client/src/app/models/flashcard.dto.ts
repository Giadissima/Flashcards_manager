import { Subject } from "./subject.dto";
import { Visibility } from './visibility.dto';
import { Topic } from "./topic.dto";

export interface Flashcard {
  _id: string;  // id generato da MongoDB

  title: string;
  question: string;
  answer: string;

  topic_id?: string | Topic; // populated by the server, a plain id on the way back
  subject_id?: string | Subject; // populated by the server, a plain id on the way back

  /** Who may see it; absent on payloads that leave it unchanged. */
  visibility?: Visibility;

  /** True on a copy taken from someone else's post, which can never go back out. */
  imported?: boolean;
}

/** One of the flashcards drawn for a new test, with the topic it is on. */
export interface RandomFlashcard {
  _id: string;
  topic_id: string;
}
