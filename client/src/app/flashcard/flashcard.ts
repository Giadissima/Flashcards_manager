import { Flashcard } from '../models/flashcard';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FlashcardService {
private baseUrl = 'http://localhost:3000/flashcards'; // <-- metti l'endpoint giusto

  constructor(private http: HttpClient) {}

  // Leggere tutte le flashcard
  getFlashcards(): Observable<Flashcard[]> {
    return this.http.get<Flashcard[]>(this.baseUrl);
  }

  // Creare una flashcard
  createFlashcard(card: Flashcard): Observable<Flashcard> {
    return this.http.post<Flashcard>(this.baseUrl, card);
  }

  // Modificare una flashcard
  updateFlashcard(id: number, card: Flashcard): Observable<Flashcard> {
    return this.http.put<Flashcard>(`${this.baseUrl}/${id}`, card);
  }

  // Eliminare una flashcard
  deleteFlashcard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
