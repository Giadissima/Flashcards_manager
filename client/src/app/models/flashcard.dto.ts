export interface Subject{
  name: string;
  icon?: string; // TODO non deve essere una stringa!
  desc?: string;
}

export interface Group{
  color: string;
  name: string;
  _id: string;
  subject_id: string
}

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