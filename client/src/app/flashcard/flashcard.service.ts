import { PaginatedResponse, SimplePaginatedResponse } from '../models/http.dto';

import { Flashcard } from '../models/flashcard.dto';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RestClientService } from '../api/rest-api.service';
import { baseUrlAPI } from '../../config/config';

@Injectable({
  providedIn: 'root'
})
export class FlashcardService {
private baseUrl = baseUrlAPI + 'flashcards/';

  constructor(private http: HttpClient, private restClient: RestClientService) {}

  // Legge tutte le flashcard
  getAllFlashcards(filter: SimplePaginatedResponse): Promise<PaginatedResponse<Flashcard>> {
    return this.restClient.get<PaginatedResponse<Flashcard>>(
      this.baseUrl + 'all/',
      filter
    )
  }

  // Legge una singola flashcard
  getFlashcardById(id: string): Promise<Flashcard> {
    return this.restClient.get<Flashcard>(this.baseUrl + id);
  }

  // Crea una flashcard
  createFlashcard(card: Flashcard): Promise<void> {
    return this.restClient.post(this.baseUrl, card);
  }

  // Modifica una flashcard
  updateFlashcard(id: string, card: Flashcard): Promise<void> {
    return this.restClient.patch(this.baseUrl + id, card);
  }

  // Elimina una flashcard
  deleteFlashcard(id: string): Promise<void>{
    return this.restClient.delete<void>(this.baseUrl + id)
  }
}
