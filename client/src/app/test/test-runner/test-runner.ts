import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

import { CommonModule } from '@angular/common';
import { DurationPipe } from '../../../pipes/duration.pipe';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { Test } from '../../models/test.dto';
import { TestService } from '../test.service';

@Component({
  selector: 'app-test-runner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DurationPipe],
  templateUrl: './test-runner.html',
  styleUrls: ['./test-runner.scss']
})
export class TestRunner implements OnInit {
  testForm: FormGroup;
  showAnswer: boolean = false;
  testFinished = false; // TODO
  flashcard!: Flashcard;

  testId!: string;
  test: Test | undefined = undefined;
  currentIndex: number = -1;
  elapsed_time: number = 0; // in secondi
  timerSub!: Subscription;
  private startTime = 0;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private flashcardService: FlashcardService,
    private testService: TestService,
    private router: Router
  ) {
    this.testForm = this.fb.group({
      isCorrect: [null]
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('test_id');
      if(id){
        this.testId = id;
        this.getTest()
        // imposto un timer da aggiornare ogni 30 secondi
        this.timerSub = interval(1000).subscribe(() => this.updateTimer());
      }else {
        alert("non è stato possibile prendere il test");
      }
    });
  }

  updateTimer() {
    if(!this.testId) return;
    this.elapsed_time++;
    if(this.elapsed_time % 30 == 0)
      this.testService.updateElapsedTime(this.testId, this.elapsed_time)
        .catch(err => console.error('Errore aggiornamento timer', err));;
  }
  
  async getTest() {
    if(!this.testId) return;
    
    this.test = await this.testService.getById(this.testId);
    await this.loadNextFlashcard();
    // TODO if test è già finito allora dai errore e vai ai risultati
    if(this.elapsed_time == 0)
      this.elapsed_time = this.test.elapsed_time ?? 0;
  }

  ngOnDestroy() {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
  }

  async updateAnswer(){
    const answer = this.testForm.get("isCorrect")?.value;
    const flashcard_id = this.test?.questions[this.currentIndex]?.flashcard_id;
    if(answer != null && flashcard_id){
      this.testService.updateAnswer(this.testId, flashcard_id, answer);
    }
  }

  async loadNextFlashcard() {
    await this.updateAnswer();
    this.testForm.reset({ isCorrect: null });
    this.currentIndex++;
    const question = this.test?.questions[this.currentIndex]?.flashcard_id;
    if(!question) {
      this.currentIndex--;
      return;
    }
    this.flashcard = await this.flashcardService.getById(question);
    this.showAnswer = false;
  }

  async loadPreviousFlashcard() {
    await this.updateAnswer();
    this.testForm.reset({ isCorrect: null });
    this.currentIndex--;
    const question = this.test?.questions[this.currentIndex].flashcard_id;
    if(!question) {
      this.currentIndex--;
      return;
    }
    this.flashcard = await this.flashcardService.getById(question);
    this.showAnswer = false;
  }

  getCardColor(card: Flashcard): string {
    if (card.topic_id && typeof card.topic_id !== 'string' && card.topic_id.color) {
      return card.topic_id.color;
    }
    return 'blue';
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswer = !this.showAnswer;
  }

  getCardButtonText(card: Flashcard): string {
    if (!card._id) return '';
    return this.showAnswer ? 'Vedi domanda' : 'Vedi risposta';
  }

  async finishTest() {
    if(!this.test) return;
    await this.updateAnswer();
    this.test.completedAt = new Date();
    this.test.elapsed_time = this.elapsed_time;
    this.testService.update(this.testId, this.test);
    this.router.navigate(['/test-result',this.testId],);
  }
}