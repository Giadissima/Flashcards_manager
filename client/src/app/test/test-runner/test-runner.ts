import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';

@Component({
  selector: 'app-test-runner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './test-runner.html',
  styleUrls: ['./test-runner.scss']
})
export class TestRunner implements OnInit {
  testForm: FormGroup;
  flashcards: Flashcard[] = [];
  currentCardIndex = 0;
  showAnswerMap: Record<string, boolean> = {};
  testFinished = false;
  correctAnswers = 0;
  incorrectAnswers = 0;
  elapsedTime = '0';
  private startTime = 0;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private flashcardService: FlashcardService,
    private router: Router
  ) {
    this.testForm = this.fb.group({
      answers: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.startTime = Date.now();
    this.route.queryParams.subscribe(params => {
      const groupId = params['group_id'];
      const subjectId = params['subject_id'];
      const num = params['num'];

      if ((groupId || subjectId) && num) {
        this.loadFlashcards({
          group_id: groupId,
          subject_id: subjectId,
          limit: num
        });
      }
    });
  }

  get answers(): FormArray {
    return this.testForm.get('answers') as FormArray;
  }

  loadFlashcards(filters: { group_id?: string, subject_id?: string, limit: number }): void {
    this.flashcardService.getAll({
      group_id: filters.group_id,
      subject_id: filters.subject_id,
      limit: filters.limit,
      skip: 0,
      sortDirection: 'asc',
      sortField: '_id'
    }).then(response => {
      this.flashcards = response.data;
      this.flashcards.forEach(() => {
        this.answers.push(this.fb.group({ isCorrect: null }));
      });
    });
  }

  getCardColor(card: Flashcard): string {
    if (card.group_id && typeof card.group_id !== 'string' && card.group_id.color) {
      return card.group_id.color;
    }
    return 'blue';
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  getCardButtonText(card: Flashcard): string {
    if (!card._id) return '';
    return this.showAnswerMap[card._id] ? 'Vedi domanda' : 'Vedi risposta';
  }

  nextCard(): void {
    if (this.currentCardIndex < this.flashcards.length - 1) {
      this.currentCardIndex++;
    }
  }

  previousCard(): void {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
    }
  }

  finishTest(): void {
    const endTime = Date.now();
    this.elapsedTime = ((endTime - this.startTime) / 1000 / 60).toFixed(2);
    this.correctAnswers = this.answers.controls.filter(control => control.value.isCorrect === true).length;
    this.incorrectAnswers = this.answers.controls.filter(control => control.value.isCorrect === false).length;
    this.testFinished = true;

    this.router.navigate(['/test-result'], {
      state: {
        correct: this.correctAnswers,
        incorrect: this.incorrectAnswers,
        elapsedTime: this.elapsedTime,
        total: this.flashcards.length
      }
    });
  }
}