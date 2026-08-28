export interface PaginatedResponse<T> {
  count: number;
  data: T[]; // cambiare il server in "result"
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

export type RandomCardFIlter = Pick<CardFilter, 'subject_id' | 'topic_id'> & {
  numFlashcard?: number;
};

// ha gli stessi attributi di cardfilter tranne il titolo, più i filtri sulle risposte sbagliate e sullo stato
export type TestFilter = Omit<CardFilter, 'title'> & {
  onlyWrong?: boolean;
  completed?: boolean;
};

