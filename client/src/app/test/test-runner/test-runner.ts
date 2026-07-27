import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DurationPipe } from '../../../pipes/duration.pipe';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { Test } from '../../models/test.dto';
import { TestService } from '../test.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-test-runner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DurationPipe, KatexRendererPipe, ConfirmDialogComponent, TranslocoModule],
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

  showLeaveConfirm = false;
  private pendingDestination: string[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private flashcardService: FlashcardService,
    private testService: TestService,
    private router: Router,
    private transloco: TranslocoService
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
        alert(this.transloco.translate('test.runner.getTestError'));
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
    return this.transloco.translate(this.showAnswer ? 'test.runner.seeQuestion' : 'test.runner.seeAnswer');
  }

  async finishTest() {
    if(!this.test) return;
    await this.updateAnswer();
    this.test = await this.testService.getById(this.testId);
    this.test.completedAt = new Date();
    this.test.elapsed_time = this.elapsed_time;
    this.testService.update(this.testId, this.test);
    this.router.navigate(['/test-result',this.testId],);
  }

  // Apre il dialog di conferma prima di uscire dal test senza concluderlo
  requestPause(): void {
    this.pendingDestination = ['/test-result'];
    this.showLeaveConfirm = true;
  }

  requestGoHome(): void {
    this.pendingDestination = ['/home'];
    this.showLeaveConfirm = true;
  }

  cancelLeave(): void {
    this.showLeaveConfirm = false;
  }

  // Salva la risposta corrente e il tempo trascorso, poi esce senza chiudere
  // il test: rimane "in corso" e potrà essere ripreso in seguito (anche da un
  // altro dispositivo, dato che lo stato vive sul server, non nel client).
  async confirmLeave(): Promise<void> {
    this.showLeaveConfirm = false;
    await this.updateAnswer();
    if (this.testId) {
      await this.testService
        .updateElapsedTime(this.testId, this.elapsed_time)
        .catch(err => console.error('Errore salvataggio progressi', err));
    }
    this.router.navigate(this.pendingDestination);
  }
}