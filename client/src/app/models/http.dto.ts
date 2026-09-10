import { Visibility } from './visibility.dto';

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
  /** The two ends of a date range over createdAt, as YYYY-MM-DD days. */
  from?: string;
  to?: string;
}

/** What the count endpoint takes: a set of cards, narrowed by visibility. */
export type CountCardFilter = {
  subject_id?: string;
  topic_ids?: string[];
  visibility?: Visibility;
};

export type RandomCardFIlter = Pick<CardFilter, 'subject_id'> & {
  // Several topics of the subject at once; empty or absent means all of them.
  topic_ids?: string[];
  numFlashcard?: number;
};

// Same fields as CardFilter minus the title, plus the test-only filters
export type TestFilter = Omit<CardFilter, 'title'> & {
  onlyWrong?: boolean;
  completed?: boolean;
  // 'own' for tests built from the tester's own library, 'community' for
  // ones started from a community post; absent shows both.
  source?: 'own' | 'community';
};

