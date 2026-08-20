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
  // presente solo negli export in zip: immagini inline referenziate nell'HTML
  // di question/answer (<img src="/api/file/{id}">), indicizzate per id del
  // file originale, usate dall'import per ricrearle sul nuovo db
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
  // presenti solo negli export in zip: percorso dell'icona dentro l'archivio
  // e il suo mimetype, usati dall'import per ricreare il file sul nuovo db
  iconFileName?: string;
  iconMimetype?: string;
  desc: string;
  __v: number;
}
