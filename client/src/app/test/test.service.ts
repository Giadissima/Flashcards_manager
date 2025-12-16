import { PaginatedResponse, TestFilter } from '../models/http.dto';

import { Flashcard } from '../models/flashcard.dto';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { Test } from '../models/test.dto';
import { baseUrlAPI } from '../../config/config';

@Injectable({
  providedIn: 'root'
})
export class TestService {
private baseUrl = baseUrlAPI + 'test/';

  constructor(private http: HttpClient, private restClient: RestClientService) {}

  // Legge tutti i test
  getAll(filter: TestFilter): Promise<PaginatedResponse<Test>> {
      return this.restClient.get<PaginatedResponse<Test>>(
        this.baseUrl + 'all/',  
        filter
      );
    }

  // Legge un singola test
  getById(id: string): Promise<Test> {
    return this.restClient.get<Test>(this.baseUrl + id);
  }

  // Crea un test
  create(test: Test): Promise<void> {
    return this.restClient.post(this.baseUrl, test);
  }

  // Modifica un test
  update(id: string, test: Test): Promise<void> {
    return this.restClient.patch(this.baseUrl + id, test);
  }

  // Elimina un test
  delete(id: string): Promise<void>{
    return this.restClient.delete<void>(this.baseUrl + id)
  }
}
