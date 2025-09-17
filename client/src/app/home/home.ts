import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../models/flashcard.dto';
import { FlashcardService } from '../flashcard/flashcard.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit{
  flashcards!: Flashcard[];

  constructor(private flashcardsService: FlashcardService) {}

  ngOnInit(): void {
    this.flashcardsService.getAllFlashcards({
      skip: 0,
      limit: 10,
      sortField: "_id",
      sortDirection: "asc"
    }).then(f => {this.flashcards = f.data; console.dir(this.flashcards)});

  }

  
  seeAnswer(card: Flashcard): void {
    alert(`Risposta: ${card.answer}`);
  }

  deleteCard(card: Flashcard): void {
    if (!card._id) return;
    this.flashcardsService.deleteFlashcard(card._id).subscribe(() => {
      this.flashcards = this.flashcards.filter(c => c._id !== card._id);
    });
  }

  modifyCard(card: Flashcard): void {
    // qui puoi navigare verso un componente di edit
    console.log('Modifica card', card);
  }

  copyCard(card: Flashcard): void {
    // esempio: copi solo il testo
    navigator.clipboard.writeText(`${card.title}\n${card.question}\n${card.answer}`);
    alert('Card copiata negli appunti!');
  }
}
