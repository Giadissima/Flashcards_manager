// TODO vedere possibili inutilizzi
export interface SortingOptions{
  by?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationOptions{
  first?: number;
  limit?: number;
}

export interface PaginatedRequest<T>{
  sort?: SortingOptions;
  pagination?: PaginationOptions;
  filter?: Partial<T>;
  search?: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  data: T[]; // cambiare il server in "result"
}

interface FilterInterface{
  fromDate: undefined|string;
  toDate: undefined|string;
}

export interface SimplePaginatedResponse{
  sortField: string;
  sortDirection: 'asc' | 'desc';
  skip: number;
  limit: number;
  // filter: FilterInterface TODO lasciato già predisposto per la ricerca per data
}

export interface TopicFilter extends SimplePaginatedResponse {
  subject_id?: string;
}
//TODO pulire i file dto e cercare di fare meglio le divisioni delle classi/interfacce sia qui sia nel server
export interface CardFilter extends SimplePaginatedResponse {
  subject_id?: string;
  topic_id?: string;
  title?: string;
}

export type RandomCardFIlter = Pick<CardFilter, 'subject_id' | 'topic_id'> & {
  numFlashcard?: number;
};

// ha gli stessi attributi di cardfilter tranne il titolo
export type TestFilter = Omit<CardFilter, 'title'>;

