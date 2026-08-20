import { PaginatedResponse, SubjectFilter } from '../models/http.dto';

import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { Subject } from '../models/subject.dto';

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
