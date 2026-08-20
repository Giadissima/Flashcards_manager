export interface FlashcardImageMeta {
  fileName: string;
  mimetype: string;
}

export interface FlashcardFileFormat {
  _id: string;
  title: string;
  question: string;
  answer: string;
  topic_id: TopicFileFormat | undefined;
  subject_id: SubjectFileFormat | undefined;
  __v: number;
  // Present only in zip exports: the inline images referenced from the HTML of
  // question/answer (<img src="/api/file/{id}">), indexed by the id of the
  // original file, used by the import to recreate them on the new db.
  images?: Record<string, FlashcardImageMeta>;
}

export interface TopicFileFormat {
  _id: string;
  name: string;
  color: string;
  subject_id: SubjectFileFormat;
  __v: number;
}

export interface SubjectFileFormat {
  _id: string;
  name: string;
  icon: string | null;
  // Present only in zip exports: the path of the icon inside the archive and
  // its mimetype, used by the import to recreate the file on the new db.
  iconFileName?: string;
  iconMimetype?: string;
  desc: string;
  __v: number;
}
