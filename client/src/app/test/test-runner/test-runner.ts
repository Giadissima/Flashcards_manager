import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';

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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-test-runner',
  standalone: true,
  imports: [CommonModule, DurationPipe, KatexRendererPipe, ConfirmDialogComponent, TranslocoModule, LoadStateComponent, ImageLightboxComponent, ZoomableImagesDirective],
  templateUrl: './test-runner.html',
  styleUrls: ['./test-runner.scss']
})
export class TestRunner extends PaginatedList implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  testId!: string;
  elapsed_time: number = 0; // in secondi
  timerSub!: Subscription;

  // Grid of flashcards, 9 per page (3x3). The test is never held in memory as
  // a whole (it may have hundreds of questions): only the total count is known,
  // and one page at a time is fetched from the server.
  override pageSize = 9;
  pageFlashcards: Flashcard[] = [];

  // Maps flashcard_id to the answer given, for the cards already seen
  private answersMap: Record<string, boolean> = {};

  // Maps flashcard_id to whether its answer, instead of its question, is shown
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

  async finishTest() {
    if(!this.testId) return;
    await this.testService.completeTest(this.testId, this.elapsed_time);
    this.router.navigate(['/test-result',this.testId],);
  }

  // Opens the confirmation dialog before leaving a test that is not over yet
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

  // Saves the elapsed time, then leaves without closing the test: it stays in
  // progress and can be resumed later, even from another device, since the state
  // lives on the server and not in the client.
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
