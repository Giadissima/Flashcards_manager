export interface FlashcardFileFormat {
  _id: string;
  title: string;
  question: string;
  answer: string;
  group_id: GroupFileFormat | undefined;
  subject_id: SubjectFileFormat | undefined;
  __v: number;
}

export interface GroupFileFormat {
  _id: string;
  name: string;
  color: string;
  subject_id: SubjectFileFormat;
  __v: number;
}

export interface SubjectFileFormat {
  _id: string;
  name: string;
  icon: null; // TODO
  desc: string;
  __v: number;
}
