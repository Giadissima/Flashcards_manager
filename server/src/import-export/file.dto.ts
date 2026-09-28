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

// What to do with a subject/topic of the file whose name is already taken in
// the account: reuse the existing one, create a new one under another name,
// or leave out everything that belongs to it.
export const conflictActions = ['merge', 'rename', 'skip'] as const;
export type ConflictAction = (typeof conflictActions)[number];

export interface ConflictResolution {
  action: ConflictAction;
  // Only meaningful with action 'rename'
  name?: string;
}

// Keyed by the names found in the file: subject name -> resolution, and
// subject name -> topic name -> resolution. Anything missing is merged, which
// is what an import did before there was a choice.
export interface ImportResolutions {
  subjects: Map<string, ConflictResolution>;
  topics: Map<string, Map<string, ConflictResolution>>;
}

export interface ImportPreviewTopic {
  name: string;
  cards: number;
}

export interface ImportPreviewSubject {
  name: string;
  cards: number;
  // Cards of this subject already stored exactly as they are in the file
  duplicates: number;
  // Only the topics whose name is taken inside the existing subject
  topics: ImportPreviewTopic[];
}

export interface ImportPreview {
  total: number;
  // Only the subjects whose name is already taken: no conflicts, no questions
  conflicts: ImportPreviewSubject[];
}
