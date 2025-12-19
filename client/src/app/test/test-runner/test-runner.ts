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
  showAnswerMap: Record<string, boolean> = {};
  testFinished = false; // TODO
  correctAnswers = 0;
  incorrectAnswers = 0;

  testId!: string;
  questions: any[] = [];
  currentIndex: number = 0;
  timeElapsed: number = 0; // in secondi
  timerSub!: Subscription;
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
      const topicId = params['topic_id'];
      const subjectId = params['subject_id'];
      const num = params['num'];

      if ((topicId || subjectId) && num) {
        this.loadFlashcards({
          topic_id: topicId,
          subject_id: subjectId,
          limit: num
        });
      }
    });
  }

  get answers(): FormArray {
    return this.testForm.get('answers') as FormArray;
  }

  loadFlashcards(filters: { topic_id?: string, subject_id?: string, limit: number }): void {
    this.flashcardService.getAll({
      topic_id: filters.topic_id,
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
    if (card.topic_id && typeof card.topic_id !== 'string' && card.topic_id.color) {
      return card.topic_id.color;
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
    if (this.currentIndex < this.flashcards.length - 1) {
      this.currentIndex++;
    }
  }

  previousCard(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  finishTest(): void {
    const endTime = Date.now();
    this.timeElapsed = ((endTime - this.startTime) / 1000 / 60).toFixed(2);
    this.correctAnswers = this.answers.controls.filter(control => control.value.isCorrect === true).length;
    this.incorrectAnswers = this.answers.controls.filter(control => control.value.isCorrect === false).length;
    this.testFinished = true;

    this.router.navigate(['/test-result'], {
      state: {
        correct: this.correctAnswers,
        incorrect: this.incorrectAnswers,
        elapsedTime: this.timeElapsed,
        total: this.flashcards.length
      }
    });
  }
}