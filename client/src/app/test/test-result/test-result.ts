import { CommonModule, formatDate, NgClass } from '@angular/common';

import { ActivatedRoute, Router } from '@angular/router';
import { Component, Inject, LOCALE_ID, ViewChild } from '@angular/core';
import { DurationLongPipe } from '../../pipes/duration-long.pipe';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { ImageLightboxComponent } from '../../shared/image-lightbox/image-lightbox.component';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import {
  PageCardAction,
  PageCardComponent,
} from '../../shared/page-card/page-card.component';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { ScoreBarComponent } from '../../shared/score-bar/score-bar.component';
import {
  SegmentedFilterComponent,
  SegmentedOption,
} from '../../shared/segmented-filter/segmented-filter.component';
import { ToastService } from '../../shared/toast/toast.service';
import { ZoomableImagesDirective } from '../../shared/zoomable-images.directive';
import { PaginatedList } from '../../shared/paginated-list';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { Question, Test } from '../../models/test.dto';
import { getTestScore, getTestSubjectLabel } from '../test-view.util';
import { TestService } from '../test.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/** A question of the test as the review shows it, with its flashcard resolved. */
interface ReviewQuestion {
  id: string;
  title: string;
  /** 'true' | 'false' | 'blank': the outcome, as the template compares it. */
  is_correct: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-test-result',
  standalone: true,
  imports: [CommonModule, DurationLongPipe, NgClass, KatexRendererPipe, TranslocoModule, LoadStateComponent, PageCardComponent, FilterBarComponent, ScoreBarComponent, SegmentedFilterComponent, PaginationComponent, ImageLightboxComponent, ZoomableImagesDirective],
  templateUrl: './test-result.html',
  styleUrl: './test-result.scss'
})
export class TestResult extends PaginatedList {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  testId!: string;
  test!: Test;
  stats = { correct: 0, wrong: 0, blank: 0 };
  elapsed_time = 0;
  createdAt?: Date;
  completedAt?: Date;
  /** Which questions the review lists: every one of them, or one outcome. */
  outcome: 'all' | 'wrong' | 'blank' = 'all';

  /** Turns the review into a pass of study: the answers are asked for, one by one. */
  hideAnswers = false;
  private revealedAnswers = new Set<string>();

  /** Held while the repeat test is being created, so it cannot be asked twice. */
  repeating = false;

  // A test can hold hundreds of questions, and every one of them costs a
  // request for its flashcard. The review is paged like the run itself is: the
  // test carries the outcome of every question, so the filter and its counts
  // are answered without leaving the page, and only the cards of the page being
  // read are fetched.
  override pageSize = 10;
  pageQuestions: ReviewQuestion[] = [];

  /** Holds the pagination while the page it asked for is being fetched. */
  loadingPage = false;

  constructor(
    private route: ActivatedRoute,
    private testService: TestService,
    private flashcardService: FlashcardService,
    private transloco: TranslocoService,
    private toastService: ToastService,
    private router: Router,
    @Inject(LOCALE_ID) private locale: string
  ){
    super();
  }

  ngOnInit(): void {
      this.route.paramMap.subscribe(params => {
        const id = params.get('test_id');
        if(id){
          this.testId = id;
          this.loadState.run(() => this.viewTest());
        }else {
          this.router.navigate(['/not-found'], { queryParams: { message: 'common.error.testNotFound' } });
        }
      });
    }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async viewTest(): Promise<void> {
    this.test = await this.testService.getById(this.testId);

    // setup html variables
    this.stats = getTestScore(this.test);
    this.elapsed_time = this.test.elapsed_time ?? 0;
    this.completedAt = this.test.completedAt;
    this.createdAt = this.test.createdAt;

    await this.loadPage();
  }

  /**
   * The questions the filter leaves, in the order the test asked them. Only
   * their ids and outcome: the flashcards behind them are read one page at a
   * time, in loadPage.
   */
  private get selectedQuestions(): Question[] {
    const questions = this.test?.questions ?? [];
    if (this.outcome === 'wrong') return questions.filter((q) => q.is_correct === false);
    if (this.outcome === 'blank') return questions.filter((q) => q.is_correct === undefined);
    return questions;
  }

  async loadPage(): Promise<void> {
    if (!this.test) return;

    const selected = this.selectedQuestions;
    this.totalCount = selected.length;
    const pageQuestions = selected.slice(this.pageSkip, this.pageSkip + this.pageSize);

    this.loadingPage = true;
    try {
      this.pageQuestions = await Promise.all(
        pageQuestions.map(async (q) => {
          // A flashcard can be deleted while tests still reference it: the
          // review shows "not available" for that question rather than failing
          // as a whole.
          const flashcard = await this.flashcardService
            .getById(q.flashcard_id)
            .catch(() => null);
          return {
            id: flashcard?._id ?? q.flashcard_id,
            title: flashcard?.title ?? this.transloco.translate('test.result.titleNotAvailable'),
            is_correct: q.is_correct === true ? 'true' : q.is_correct === false ? 'false' : 'blank',
            question: flashcard?.question ?? this.transloco.translate('test.result.questionNotAvailable'),
            answer: flashcard?.answer ?? this.transloco.translate('test.result.answerNotAvailable'),
          };
        })
      );
    } finally {
      this.loadingPage = false;
    }
  }

  protected override onPageChange(): void {
    this.loadPage();
  }

  /**
   * What the test was about and when it was taken: the subject and the topic,
   * which is what a result opened from the history is looked up by, followed
   * by the date. The topic is only sent when the whole test shares one.
   */
  get subtitle(): string {
    const parts: string[] = [];

    const subject = this.test ? getTestSubjectLabel(this.test) : '';
    if (subject) parts.push(subject);

    const date = this.completedAt ?? this.createdAt;
    if (date) {
      const label = this.transloco.translate(
        this.completedAt ? 'test.result.completed' : 'test.result.started'
      );
      const on = this.transloco.translate('test.result.onDate');
      parts.push(`${label} ${on} ${formatDate(date, 'medium', this.locale)}`);
    }

    return parts.join(' — ');
  }

  /** The counts are the point of the strip: they say what filtering would leave. */
  get outcomeOptions(): SegmentedOption[] {
    return [
      { value: 'all', label: this.transloco.translate('test.result.outcomeAll'), count: this.test?.questions.length ?? 0 },
      { value: 'wrong', label: this.transloco.translate('test.result.outcomeWrong'), count: this.stats.wrong },
      { value: 'blank', label: this.transloco.translate('test.result.outcomeBlank'), count: this.stats.blank },
    ];
  }

  /** Shown on the collapsed filter bar of a phone, so it still says it is filtering. */
  get activeFilterCount(): number {
    return (this.outcome === 'all' ? 0 : 1) + (this.hideAnswers ? 1 : 0);
  }

  onOutcomeChange(value: string): void {
    this.outcome = value as 'all' | 'wrong' | 'blank';
    // The pages of one outcome are not the pages of another: what was page 3 of
    // every question is past the end of the four wrong ones.
    this.currentPage = 1;
    this.loadPage();
  }

  onHideAnswersChange(hide: boolean): void {
    this.hideAnswers = hide;
    // Unhiding is what the checkbox is unticked for; hiding again starts over,
    // otherwise the questions answered before would stay uncovered.
    this.revealedAnswers.clear();
  }

  isAnswerVisible(questionId: string): boolean {
    return !this.hideAnswers || this.revealedAnswers.has(questionId);
  }

  revealAnswer(questionId: string): void {
    this.revealedAnswers.add(questionId);
  }

  /**
   * The actions of the header. Repeating is the only one that reports back, so
   * the page listens to (action) without having to ask which was pressed.
   */
  get headerActions(): PageCardAction[] {
    const actions: PageCardAction[] = [];
    if (this.wrongFlashcardIds.length) {
      actions.push({
        label: this.transloco.translate('test.result.repeatWrong'),
        icon: 'replay',
        disabled: this.repeating,
      });
    }
    actions.push({
      label: this.transloco.translate('test.result.backHome'),
      icon: 'home',
      link: '/',
      variant: 'outline',
    });
    return actions;
  }

  /**
   * The flashcards a repeat would be built on. Read from the test rather than
   * from the page on screen, so the button offers every wrong question and not
   * only the ones currently listed. A flashcard deleted since is left out of
   * the run by the runner, the way it already is for any other test.
   */
  get wrongFlashcardIds(): string[] {
    return (this.test?.questions ?? [])
      .filter((q) => q.is_correct === false)
      .map((q) => q.flashcard_id);
  }

  /**
   * Starts a new test on the questions this one got wrong. It goes straight to
   * the runner rather than through the setup page: the questions are already
   * decided, so there is nothing left to set up.
   */
  async repeatWrong(): Promise<void> {
    const ids = this.wrongFlashcardIds;
    if (!ids.length || this.repeating) return;

    this.repeating = true;
    try {
      const test = await this.testService.create({
        questions: ids.map((flashcard_id) => ({ flashcard_id })),
      });
      this.router.navigate(['/test', test._id]);
    } catch (err) {
      console.error(err);
      this.toastService.show(this.transloco.translate('test.result.repeatError'), 'error');
    } finally {
      this.repeating = false;
    }
  }
}
