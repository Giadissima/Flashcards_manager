import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';

import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DurationPipe } from '../../../pipes/duration.pipe';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { Subject } from '../../models/subject.dto';
import { Topic } from '../../models/topic.dto';
import { TestService } from '../test.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getSubjectIconUrl } from '../../subject/subject-icon.util';

@Component({
  selector: 'app-test-runner',
  standalone: true,
  imports: [CommonModule, DurationPipe, KatexRendererPipe, ConfirmDialogComponent, TranslocoModule, LoadStateComponent],
  templateUrl: './test-runner.html',
  styleUrls: ['./test-runner.scss']
})
export class TestRunner implements OnInit {
  testFinished = false; // TODO

  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  testId!: string;
  elapsed_time: number = 0; // in secondi
  timerSub!: Subscription;

  // Griglia di flashcard, 9 per pagina (3x3). Il test non viene mai tenuto
  // per intero in memoria (potrebbe avere centinaia di domande): si conosce
  // solo il conteggio totale e si carica dal server una pagina alla volta.
  totalQuestions = 0;
  pageFlashcards: Flashcard[] = [];
  pageSize = 9;
  currentPage = 1;

  // mappa flashcard_id -> boolean (risposta data, per le card già viste)
  private answersMap: Record<string, boolean> = {};

  // mappa flashcard_id -> boolean (true = mostra risposta)
  showAnswerMap: Record<string, boolean> = {};

  showLeaveConfirm = false;
  private pendingDestination: string[] = [];

  subjectName = '';
  testStartDate?: Date;
  answeredCount = 0;

  constructor(
    private route: ActivatedRoute,
    private flashcardService: FlashcardService,
    private testService: TestService,
    private router: Router,
    private transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('test_id');
      if(id){
        this.testId = id;
        this.loadState.run(() => this.getTest());
      }else {
        this.router.navigate(['/not-found'], { queryParams: { message: 'common.error.testNotFound' } });
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

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async getTest(): Promise<void> {
    if(!this.testId) return;

    const { count, elapsed_time } = await this.testService.getQuestionsCount(this.testId);
    this.totalQuestions = count;
    if(this.elapsed_time == 0)
      this.elapsed_time = elapsed_time ?? 0;

    const test = await this.testService.getById(this.testId);
    this.testStartDate = test.createdAt;
    this.answeredCount = test.questions.filter(q => q.is_correct !== undefined).length;

    await this.loadPage();
    if (this.pageFlashcards.length > 0) {
      this.subjectName = this.getCardSubjectName(this.pageFlashcards[0]);
    }

    // timer starts only now: the test data is actually available
    this.timerSub = interval(1000).subscribe(() => this.updateTimer());
  }

  ngOnDestroy() {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalQuestions / this.pageSize));
  }

  async loadPage(): Promise<void> {
    if (!this.testId) return;
    const skip = (this.currentPage - 1) * this.pageSize;
    const pageQuestions = await this.testService.getQuestionsPage(this.testId, skip, this.pageSize);
    for (const q of pageQuestions) {
      if (q.is_correct !== undefined) this.answersMap[q.flashcard_id] = q.is_correct;
    }
    this.pageFlashcards = await Promise.all(
      pageQuestions.map((q) => this.flashcardService.getById(q.flashcard_id))
    );
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.loadPage();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.loadPage();
  }

  isCorrectAnswer(card: Flashcard): boolean | undefined {
    return card._id ? this.answersMap[card._id] : undefined;
  }

  setAnswer(card: Flashcard, isCorrect: boolean): void {
    if (!card._id) return;
    const wasAnswered = this.answersMap[card._id] !== undefined;
    const newValue = this.answersMap[card._id] === isCorrect ? undefined : isCorrect;
    if (newValue === undefined) {
      delete this.answersMap[card._id];
    } else {
      this.answersMap[card._id] = newValue;
    }
    if (wasAnswered && newValue === undefined) this.answeredCount--;
    if (!wasAnswered && newValue !== undefined) this.answeredCount++;
    this.testService.updateAnswer(this.testId, card._id, newValue);
  }

  getCardColor(card: Flashcard): string {
    if (card.topic_id && typeof card.topic_id !== 'string' && card.topic_id.color) {
      return card.topic_id.color;
    }
    return 'blue';
  }

  getCardSubjectIconUrl(card: Flashcard): string {
    const subject = card.subject_id && typeof card.subject_id !== 'string' ? card.subject_id : undefined;
    return getSubjectIconUrl(subject as Subject | undefined);
  }

  getCardSubjectName(card: Flashcard): string {
    return card.subject_id && typeof card.subject_id !== 'string' ? card.subject_id.name : '';
  }

  getCardTopicName(card: Flashcard): string {
    return card.topic_id && typeof card.topic_id !== 'string' ? (card.topic_id as Topic).name : '';
  }

  getCardBody(card: Flashcard): string {
    if (!card._id) return card.question;
    return '<p>' + (this.showAnswerMap[card._id] ? card.answer : card.question) + '</p>';
  }

  getCardButtonText(card: Flashcard): string {
    if (!card._id) return '';
    return this.transloco.translate(this.showAnswerMap[card._id] ? 'test.runner.seeQuestion' : 'test.runner.seeAnswer');
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  async finishTest() {
    if(!this.testId) return;
    await this.testService.completeTest(this.testId, this.elapsed_time);
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

  // Salva il tempo trascorso, poi esce senza chiudere il test: rimane "in corso"
  // e potrà essere ripreso in seguito (anche da un altro dispositivo, dato che
  // lo stato vive sul server, non nel client).
  async confirmLeave(): Promise<void> {
    this.showLeaveConfirm = false;
    if (this.testId) {
      await this.testService
        .updateElapsedTime(this.testId, this.elapsed_time)
        .catch(err => console.error('Errore salvataggio progressi', err));
    }
    this.router.navigate(this.pendingDestination);
  }
}
