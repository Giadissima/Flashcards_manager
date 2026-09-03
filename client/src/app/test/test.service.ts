import { HttpParams } from '@angular/common/http';
import { PaginatedResponse, TestFilter } from '../models/http.dto';

import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { Question, Test, TestStats, TestTopic } from '../models/test.dto';

@Injectable({
  providedIn: 'root'
})
export class TestService {
private baseUrl = 'test';

  constructor(private restClient: RestClientService) {}

  // Reads one page of tests
  getAll(filter: TestFilter): Promise<PaginatedResponse<Test>> {
      return this.restClient.get<PaginatedResponse<Test>>(
        this.baseUrl + '/all',  
        filter
      );
    }

  // Reads a single test
  getById(id: string): Promise<Test> {
    return this.restClient.get<Test>(this.baseUrl + '/' + id);
  }

  // Total number of questions, without downloading the whole 'questions' array
  getQuestionsCount(testId: string): Promise<{ count: number; elapsed_time?: number }> {
    return this.restClient.get(`${this.baseUrl}/${testId}/questions/count`);
  }

  // One page of questions of the test (skip/limit)
  getQuestionsPage(testId: string, skip: number, limit: number): Promise<Question[]> {
    return this.restClient.get(`${this.baseUrl}/${testId}/questions`, { skip, limit });
  }

  // The topics the questions of the test are on, each with its flashcards
  getTopics(testId: string): Promise<TestTopic[]> {
    return this.restClient.get<TestTopic[]>(`${this.baseUrl}/${testId}/topics`);
  }

  // Marks the test as completed without reading back and rewriting the whole document
  completeTest(testId: string, elapsed_time: number): Promise<void> {
    const params = new HttpParams().set('time', elapsed_time);
    return this.restClient.patch(`${this.baseUrl}/${testId}/complete`, {}, params);
  }

  // Aggregate stats over the tests, filtered the same way as getAll
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

  // Creates a test
  create(test: Test): Promise<Test> {
    return this.restClient.post(this.baseUrl, test);
  }

  // Updates a test
  update(id: string, test: Test): Promise<void> {
    return this.restClient.patch(this.baseUrl + '/' + id, test);
  }

  // Deletes a test
  delete(id: string): Promise<void>{
    return this.restClient.delete<void>(this.baseUrl + '/' + id)
  }

  updateAnswer(test_id: string, flashcard_id: string, is_correct: boolean | undefined): Promise<void> {
    const queryParam = is_correct === undefined ? new HttpParams() : new HttpParams().set('is_correct', is_correct);
    return this.restClient.patch(`${this.baseUrl}/${test_id}/answer/${flashcard_id}`, {}, queryParam);
  }
}
