import { CommonModule, DatePipe, NgClass } from '@angular/common';

import { ActivatedRoute } from '@angular/router';
import { Component } from '@angular/core';
import { DurationExtendedFormatPipe } from '../../../pipes/duration.extended.pipe';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { Test } from '../../models/test.dto';
import { TestService } from '../test.service';

@Component({
  selector: 'app-test-result',
  standalone: true,
  imports: [DatePipe, CommonModule,DurationExtendedFormatPipe, NgClass],
  templateUrl: './test-result.html',
  styleUrl: './test-result.scss'
})
export class TestResult {
  testId!: string;
  test!: Test;
  stats = { correct: 0, wrong: 0, blank: 0 };
  elapsed_time = 0;
  createdAt?: Date;
  completedAt?: Date;
  questions: {
        id: string,
        is_correct: string,
        question: string,
        answer: string
      }[] = [];;

  constructor(
    private route: ActivatedRoute,
    private testService: TestService,
    private flashcardService: FlashcardService
  ){}

  ngOnInit(): void {
      this.route.paramMap.subscribe(params => {
        const id = params.get('test_id');
        if(id){
          this.testId = id;
          this.viewTest();
        }else {
          alert("non è stato possibile prendere il test");
        }
      });
    }

  async viewTest() {
    //get test
    if(!this.testId) return;
    this.test = await this.testService.getById(this.testId);
    if(!this.test) {
      alert("error getting test");
      return;
    }

    // setup html variables
    this.stats = this.test.questions.reduce(
      (acc, q) => {
        if (q.is_correct === true) acc.correct++;
        else if (q.is_correct === false) acc.wrong++;
        else acc.blank++;
        return acc;
      },
      { correct: 0, wrong: 0, blank: 0 }
    );
    this.elapsed_time = this.test.elapsed_time ?? 0;
    this.completedAt = this.test.completedAt;
    this.createdAt = this.test.createdAt;

    // load questions' array
    await this.loadQuestions();
  }

  async loadQuestions() {
  if (!this.test || !this.test.questions) return;

  this.questions = await Promise.all(
    this.test.questions.map(async (q) => {
      const flashcard = await this.flashcardService.getById(q.flashcard_id);
      let res;
      if(q.is_correct === true) res = 'true';
      else if(q.is_correct === false) res = 'false';
      else res = 'blank';
      return {
        id: flashcard?._id,
        is_correct: res,
        question: flashcard?.question ?? 'Domanda non disponibile',
        answer: flashcard?.answer ?? 'Risposta non disponibile'

      };
    })
  );
}
 // TODO aggiungere con le pipe il completato at e creato at:
}
