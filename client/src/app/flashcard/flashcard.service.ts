import { CardFilter, PaginatedResponse, RandomCardFIlter } from '../models/http.dto';

import { Flashcard, RandomFlashcard } from '../models/flashcard.dto';
import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class FlashcardService {
  private baseUrl = 'flashcards';

  constructor(private restClient: RestClientService) {}

  // Reads one page of flashcards
  getAll(filter: CardFilter): Promise<PaginatedResponse<Flashcard>> {
      return this.restClient.get<PaginatedResponse<Flashcard>>(
        this.baseUrl + '/all',
        filter
      );
    }

  // The drawn flashcards carry the topic each is on: the test is built from
  // them, and it keeps every topic it touches.
  getRandom(filter: RandomCardFIlter): Promise<RandomFlashcard[]> {
      return this.restClient.get<RandomFlashcard[]>(
        this.baseUrl + '/random',
        filter
      );
    }


  // Counts the flashcards matching the filters
  count(filter: Pick<RandomCardFIlter, 'subject_id' | 'topic_id'>): Promise<number> {
    return this.restClient.get<number>(
      this.baseUrl + '/count',
      filter
    );
  }

  // Reads a single flashcard
  getById(id: string): Promise<Flashcard> {
    return this.restClient.get<Flashcard>(this.baseUrl + '/' + id);
  }

  // Creates a flashcard
  create(card: Flashcard): Promise<void> {
    return this.restClient.post(this.baseUrl, card);
  }

  // Updates a flashcard
  update(id: string, card: Omit<Flashcard, '_id'>): Promise<void> {
    return this.restClient.patch(this.baseUrl + '/' + id, card);
  }

  // Deletes a flashcard
  delete(id: string): Promise<void>{
    return this.restClient.delete<void>(this.baseUrl + '/' + id)
  }
}
