import { PaginatedResponse, SubjectFilter } from '../models/http.dto';

import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { Subject } from '../models/subject.dto';
import { selectableListLimit } from '../../config/config';

@Injectable({
  providedIn: 'root'
})
export class SubjectService {
  private baseUrl = 'subject';

  constructor(private restClient: RestClientService) {}

  getAllSubjects(filter: SubjectFilter): Promise<PaginatedResponse<Subject>> {
    return this.restClient.get<PaginatedResponse<Subject>>(
      this.baseUrl + '/all',
      filter
    );
  }

  /** The alphabetical list every subject dropdown in the app is filled with. */
  async getSelectableSubjects(): Promise<Subject[]> {
    const response = await this.getAllSubjects({
      skip: 0,
      limit: selectableListLimit,
      sortField: 'name',
      sortDirection: 'asc',
    });
    return response.data;
  }

  getSubjectById(id: string): Promise<Subject> {
    return this.restClient.get<Subject>(this.baseUrl + '/' + id);
  }

  createSubject(subject: FormData): Promise<void> {
    return this.restClient.post(this.baseUrl, subject);
  }

  updateSubject(id: string, subject: FormData): Promise<void> {
    return this.restClient.patch(this.baseUrl + '/' + id, subject);
  }

  deleteSubject(id: string): Promise<void> {
    return this.restClient.delete<void>(this.baseUrl + '/' + id);
  }
}
