import { Course, University } from '../models/university.dto';

import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class UniversityService {
  private baseUrl = 'university';

  // The list is the same for everyone and changes once a year: fetched once and
  // kept, so moving between the pages that need it costs nothing.
  private universities?: Promise<University[]>;

  constructor(private restClient: RestClientService) {}

  getUniversities(): Promise<University[]> {
    this.universities ??= this.restClient.get<University[]>(this.baseUrl);
    return this.universities;
  }

  /** Empty for the post-graduate institutions, which have no degree courses. */
  getCourses(universityCode: string): Promise<Course[]> {
    return this.restClient.get<Course[]>(`${this.baseUrl}/${universityCode}/courses`);
  }
}
