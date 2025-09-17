export interface Flashcard {
  _id?: string;  // id generato da MongoDB

  title: string;
  question: string;
  answer: string;

  group_id?: string;      // ObjectId serializzato come stringa (lato client viene castato sempre a stringa)
  subject_id?: string;    // ObjectId serializzato come stringa
  question_img_id?: string; 
  answer_img_id?: string;
}
