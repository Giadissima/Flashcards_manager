import { Group } from "./group.dto";
import { Subject } from "./subject.dto";

export interface Flashcard {
  _id: string;  // id generato da MongoDB

  title: string;
  question: string;
  answer: string;

  group_id?: string | Group;      // ObjectId serializzato come stringa (lato client viene castato sempre a stringa)
  subject_id?: string | Subject;    // ObjectId serializzato come stringa
  question_img_id?: string; 
  answer_img_id?: string;
}