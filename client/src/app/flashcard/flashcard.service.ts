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

  // Crea una flashcard
  createFlashcard(card: Flashcard): Observable<Flashcard> {
    return this.http.post<Flashcard>(this.baseUrl, card);
  }

  // Modifica una flashcard
  updateFlashcard(id: number, card: Flashcard): Observable<Flashcard> {
    return this.http.put<Flashcard>(`${this.baseUrl}/${id}`, card);
  }

  // Elimina una flashcard
  deleteFlashcard(id: string): Promise<void>{
    return this.restClient.delete<void>(this.baseUrl + id)
  }
}
