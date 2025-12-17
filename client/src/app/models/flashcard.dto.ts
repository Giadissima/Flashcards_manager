import { Subject } from "./subject.dto";
import { Topic } from "./topic.dto";

export interface Flashcard {
  _id: string;  // id generato da MongoDB

  title: string;
  question: string;
  answer: string;

  topic_id?: string | Topic;      // ObjectId serializzato come stringa (lato client viene castato sempre a stringa)
  subject_id?: string | Subject;    // ObjectId serializzato come stringa
  question_img_id?: string; 
  answer_img_id?: string;
}

