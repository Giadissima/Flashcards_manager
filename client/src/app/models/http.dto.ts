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

export interface GroupFilter extends SimplePaginatedResponse {
  subject_id?: string;
}