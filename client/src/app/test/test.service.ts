import { HttpParams } from '@angular/common/http';
import { PaginatedResponse, TestFilter } from '../models/http.dto';

import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { Question, Test, TestStats } from '../models/test.dto';

@Injectable({
  providedIn: 'root'
})
export class TestService {
private baseUrl = 'test';

  constructor(private restClient: RestClientService) {}

  // Legge tutti i test
  getAll(filter: TestFilter): Promise<PaginatedResponse<Test>> {
      return this.restClient.get<PaginatedResponse<Test>>(
        this.baseUrl + '/all',  
        filter
      );
    }

  // Legge un singolo test
  getById(id: string): Promise<Test> {
    return this.restClient.get<Test>(this.baseUrl + '/' + id);
  }

  // Numero totale di domande del test (senza scaricare l'intero array 'questions')
  getQuestionsCount(testId: string): Promise<{ count: number; elapsed_time?: number }> {
    return this.restClient.get(`${this.baseUrl}/${testId}/questions/count`);
  }

  // Una pagina di domande del test (skip/limit)
  getQuestionsPage(testId: string, skip: number, limit: number): Promise<Question[]> {
    return this.restClient.get(`${this.baseUrl}/${testId}/questions`, { skip, limit });
  }

  // Segna il test come completato senza dover rileggere/riscrivere l'intero documento
  completeTest(testId: string, elapsed_time: number): Promise<void> {
    const params = new HttpParams().set('time', elapsed_time);
    return this.restClient.patch(`${this.baseUrl}/${testId}/complete`, {}, params);
  }

  // Legge le statistiche aggregate sui test, filtrabili come getAll
  getStats(filter?: Pick<TestFilter, 'subject_id' | 'topic_id' | 'onlyWrong' | 'completed'>): Promise<TestStats> {
    return this.restClient.get<TestStats>(this.baseUrl + '/stats', filter);
  }

  updateElapsedTime(testId: string, elapsed_time: number): Promise<void> {
    const params = new HttpParams().set('time', elapsed_time);
    return this.restClient.patch(
      `${this.baseUrl}/${testId}/time`,
      {},
      params
    );
  }

  // Crea un test
  create(test: Test): Promise<Test> {
    return this.restClient.post(this.baseUrl, test);
  }

  // Modifica un test
  update(id: string, test: Test): Promise<void> {
    return this.restClient.patch(this.baseUrl + '/' + id, test);
  }

  // Elimina un test
  delete(id: string): Promise<void>{
    return this.restClient.delete<void>(this.baseUrl + '/' + id)
  }

  updateAnswer(test_id: string, flashcard_id: string, is_correct: boolean | undefined): Promise<void> {
    const queryParam = is_correct === undefined ? new HttpParams() : new HttpParams().set('is_correct', is_correct);
    return this.restClient.patch(`${this.baseUrl}/${test_id}/answer/${flashcard_id}`, {}, queryParam);
  }
}
