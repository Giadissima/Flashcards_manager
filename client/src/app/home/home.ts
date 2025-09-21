import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../models/flashcard.dto';
import { FlashcardService } from '../flashcard/flashcard.service';
import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Toast],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit{
  flashcards!: Flashcard[];
  
  // mappa _id -> boolean (true = mostra risposta)
  showAnswerMap: Record<string, boolean> = {};

  constructor(private flashcardsService: FlashcardService, private toast: ToastService) {}

  ngOnInit(): void {
    this.flashcardsService.getAllFlashcards({
      skip: 0,
      limit: 10,
      sortField: "_id",
      sortDirection: "asc"
    }).then(f => {
      this.flashcards = f.data; 
      console.dir(this.flashcards); // TODO rimuoverlo
      this.flashcards.forEach(card => {
          if (card._id) this.showAnswerMap[card._id] = false;
        });
    });

  }

  getCardColor(card: Flashcard): string {
    // se group_id è un oggetto Group, usa il suo colore
    if (card.group_id && typeof card.group_id !== 'string' && card.group_id.color) {
      return card.group_id.color;
    }
    // fallback
    return 'blue';
  }

  getCardBody(card: Flashcard): string {
    if (!card._id) return card.question;
    return this.showAnswerMap[card._id] ? card.answer : card.question;
  }

  // cambia da 'Vedi risposta' a 'Vedi domanda'
  getCardButtonText(card: Flashcard): string {
    return this.showAnswerMap[card._id] ? 'Vedi domanda' : 'Vedi risposta';
  }

  seeAnswer(card: Flashcard): void {
    if(!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  async deleteCard(card: Flashcard): Promise<void> {
    if (!card._id) return;
    try {
      await this.flashcardsService.deleteFlashcard(card._id);
      this.toast.show("Card succesfully deleted", 'success');
      this.flashcards = this.flashcards.filter(c => c._id !== card._id);
    } catch (error: any) {
      this.toast.show("Error", 'error');
    }
  }

  modifyCard(card: Flashcard): void {
    // qui puoi navigare verso un componente di edit
    console.log('Modifica card', card);
  }

  copyCard(card: Flashcard): void {
    // esempio: copi solo il testo
    navigator.clipboard.writeText(`${card.title}\nQuestion: ${card.question}\nAnswer: ${card.answer}`);
    alert('Card copiata negli appunti!');
  }
}
