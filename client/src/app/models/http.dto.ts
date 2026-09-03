export interface PaginatedResponse<T> {
  count: number;
  data: T[]; // TODO rename to "result" on the server side too
}

export interface SimplePaginatedResponse{
  sortField: string;
  sortDirection: 'asc' | 'desc';
  skip: number;
  limit: number;
}

export interface TopicFilter extends SimplePaginatedResponse {
  subject_id?: string;
  title?: string;
}

export interface SubjectFilter extends SimplePaginatedResponse {
  title?: string;
}

export interface CardFilter extends SimplePaginatedResponse {
  subject_id?: string;
  topic_id?: string;
  title?: string;
}

export type RandomCardFIlter = Pick<CardFilter, 'subject_id'> & {
  // Several topics of the subject at once; empty or absent means all of them.
  topic_ids?: string[];
  numFlashcard?: number;
};

// Same fields as CardFilter minus the title, plus the test-only filters
export type TestFilter = Omit<CardFilter, 'title'> & {
  onlyWrong?: boolean;
  completed?: boolean;
};

