import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PageCardComponent } from '../../shared/page-card/page-card.component';

import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DurationPipe } from '../../pipes/duration.pipe';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { ImageLightboxComponent } from '../../shared/image-lightbox/image-lightbox.component';
import { PaginatedList } from '../../shared/paginated-list';
import { ZoomableImagesDirective } from '../../shared/zoomable-images.directive';
import * as cardView from '../../shared/flashcard-view.util';
import { TestService } from '../test.service';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-test-runner',
  standalone: true,
  imports: [CommonModule, DurationPipe, KatexRendererPipe, ConfirmDialogComponent, TranslocoModule, LoadStateComponent, ImageLightboxComponent, ZoomableImagesDirective, PaginationComponent, PageCardComponent],
  templateUrl: './test-runner.html',
  styleUrls: ['./test-runner.scss']
})
export class TestRunner extends PaginatedList implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  testId!: string;
  elapsed_time: number = 0; // in secondi
  timerSub!: Subscription;

  // A column of 10 flashcards per page. The test is never held in memory as
  // a whole (it may have hundreds of questions): only the total count is known,
  // and one page at a time is fetched from the server.
  override pageSize = 10;
  pageFlashcards: Flashcard[] = [];

  // Maps flashcard_id to the answer given, for the cards already seen
  private answersMap: Record<string, boolean> = {};

  // Maps flashcard_id to whether its answer, instead of its question, is shown
  showAnswerMap: Record<string, boolean> = {};

  /** The timer is stopped and the run stays on screen, waiting to be resumed. */
  isPaused = false;

  showFinishConfirm = false;

  subjectName = '';
  testStartDate?: Date;
  answeredCount = 0;

  /** Share of the test already answered, for the progress bar in the header. */
  get progressPercent(): number {
    if (!this.totalCount) return 0;
    return Math.round((this.answeredCount / this.totalCount) * 100);
  }

  /** Questions still without an answer: what ending the test now would leave blank. */
  get unansweredCount(): number {
    return this.totalCount - this.answeredCount;
  }

  // The dialog states what ending the test costs, instead of asking whether the
  // user is sure: the questions left over stay blank and the test can no longer
  // be resumed, only reviewed.
  get finishConfirmMessage(): string {
    if (this.unansweredCount <= 0) {
      return this.transloco.translate('test.runner.endConfirmMessageAll');
    }
    return this.transloco.translate('test.runner.endConfirmMessage', {
      answered: this.answeredCount,
      total: this.totalCount,
      remaining: this.unansweredCount,
    });
  }

  constructor(
    private route: ActivatedRoute,
    private flashcardService: FlashcardService,
    private testService: TestService,
    private router: Router,
    private transloco: TranslocoService,
    private toast: ToastService
  ) {
    super();
  }

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
    if(!this.testId || this.isPaused) return;
    this.elapsed_time++;
    if(this.elapsed_time % 30 == 0)
      this.testService.updateElapsedTime(this.testId, this.elapsed_time)
        .catch(err => console.error('Errore aggiornamento timer', err));;
  }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async getTest(): Promise<void> {
    if(!this.testId) return;

    const { count, elapsed_time } = await this.testService.getQuestionsCount(this.testId);
    this.totalCount = count;
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

  async loadPage(): Promise<void> {
    if (!this.testId) return;
    const pageQuestions = await this.testService.getQuestionsPage(this.testId, this.pageSkip, this.pageSize);
    for (const q of pageQuestions) {
      if (q.is_correct !== undefined) this.answersMap[q.flashcard_id] = q.is_correct;
    }
    // A flashcard can be deleted while tests still reference it: the ones that
    // are gone are left out of the page instead of breaking the whole run.
    const loaded = await Promise.all(
      pageQuestions.map((q) =>
        this.flashcardService.getById(q.flashcard_id).catch(() => null)
      )
    );
    this.pageFlashcards = loaded.filter((card): card is Flashcard => card !== null);
  }

  protected override onPageChange(): void {
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
    return cardView.getCardColor(card);
  }

  getCardSubjectIconUrl(card: Flashcard): string {
    return cardView.getCardSubjectIconUrl(card);
  }

  getCardSubjectName(card: Flashcard): string {
    return cardView.getCardSubjectName(card);
  }

  getCardTopicName(card: Flashcard): string {
    return cardView.getCardTopicName(card);
  }

  getCardBody(card: Flashcard): string {
    return cardView.getCardBody(card, this.showAnswerMap[card._id]);
  }

  getCardButtonText(card: Flashcard): string {
    if (!card._id) return '';
    return this.transloco.translate(this.showAnswerMap[card._id] ? 'test.runner.seeQuestion' : 'test.runner.seeAnswer');
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  // Stops the clock without leaving the page: nothing else about the run
  // changes, so the elapsed time is written out right away and the same button
  // starts it again.
  togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused && this.testId) {
      this.testService
        .updateElapsedTime(this.testId, this.elapsed_time)
        .catch(err => console.error('Errore salvataggio progressi', err));
    }
  }

  // Leaves the run without closing it: every answer is already on the server,
  // so there is nothing to confirm and nothing to lose. The test stays in
  // progress and the history it lands on is where it is resumed from, even from
  // another device.
  async exitTest(): Promise<void> {
    if (this.testId) {
      await this.testService
        .updateElapsedTime(this.testId, this.elapsed_time)
        .catch(err => console.error('Errore salvataggio progressi', err));
    }
    this.toast.show(this.transloco.translate('test.runner.toast.exited'), 'success');
    this.router.navigate(['/test-result']);
  }

  // The one action of the page that cannot be undone, and the only one that
  // asks before going through with it
  requestFinish(): void {
    this.showFinishConfirm = true;
  }

  cancelFinish(): void {
    this.showFinishConfirm = false;
  }

  async confirmFinish(): Promise<void> {
    this.showFinishConfirm = false;
    if (!this.testId) return;
    await this.testService.completeTest(this.testId, this.elapsed_time);
    this.router.navigate(['/test-result', this.testId]);
  }
}
