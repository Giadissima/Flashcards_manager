import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { baseUrlAPI } from '../../config/config';
import { PaginatedResponse, SimplePaginatedResponse } from '../models/http.dto';
import { Subject } from '../models/subject.dto';

@Injectable({
  providedIn: 'root'
})
export class SubjectService {
  private baseUrl = baseUrlAPI + 'subject/';

  constructor(private restClient: RestClientService) {}

  getAllSubjects(filter: SimplePaginatedResponse): Promise<PaginatedResponse<Subject>> {
    return this.restClient.get<PaginatedResponse<Subject>>(
      this.baseUrl + 'all/',
      filter
    );
  }

  getSubjectById(id: string): Promise<Subject> {
    return this.restClient.get<Subject>(this.baseUrl + id);
  }

  createSubject(subject: FormData): Promise<void> {
    return this.restClient.post(this.baseUrl, subject);
  }

  updateSubject(id: string, subject: Partial<Subject>): Promise<void> {
    return this.restClient.patch(this.baseUrl + id, subject);
  }

  deleteSubject(id: string): Promise<void> {
    return this.restClient.delete<void>(this.baseUrl + id);
  }
}
