import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { CommunityService } from '../community.service';
import { Flashcard } from '../../models/flashcard.dto';
import { ImageLightboxComponent } from '../../shared/image-lightbox/image-lightbox.component';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PaginatedList } from '../../shared/paginated-list';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PostContents } from '../../models/post.dto';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ZoomableImagesDirective } from '../../shared/zoomable-images.directive';
import * as cardView from '../../shared/flashcard-view.util';
import { getDefaultSubjectIconDataUrl } from '../../subject/subject-icon.util';

/**
 * A trial run over a community post's flashcards, opened straight from the
 * feed instead of the reader's own library: nothing here is saved.
 *
 * Unlike app-test-runner, there is no Test document and no per-answer request
 * to the server - the cards belong to whoever shared the post, not to the
 * reader, so there is nothing of theirs to persist a run against. Answers are
 * only kept in memory, for the score shown when the run ends, and are gone
 * the moment the page is left.
 */
@Component({
  selector: 'app-post-try',
  standalone: true,
  imports: [CommonModule, KatexRendererPipe, TranslocoModule, LoadStateComponent, ImageLightboxComponent, ZoomableImagesDirective, PaginationComponent, PageCardComponent],
  templateUrl: './post-try.component.html',
  styleUrls: ['./post-try.component.scss'],
})
export class PostTryComponent extends PaginatedList implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  postId!: string;
  topicId?: string;

  override pageSize = 10;
  pageFlashcards: Flashcard[] = [];

  /** In memory only: the run leaves nothing behind once the page is closed. */
  private answersMap: Record<string, boolean> = {};
  showAnswerMap: Record<string, boolean> = {};
  answeredCount = 0;
  /** How many of the answered cards were marked correct, for the closing score. */
  private correctCount = 0;

  subjectName = '';
  subjectIconUrl = '';

  get progressPercent(): number {
    if (!this.totalCount) return 0;
    return Math.round((this.answeredCount / this.totalCount) * 100);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private transloco: TranslocoService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('postId');
      if (!id) {
        this.router.navigate(['/not-found'], { queryParams: { message: 'common.error.testNotFound' } });
        return;
      }
      this.postId = id;
      this.topicId = this.route.snapshot.queryParamMap.get('topicId') ?? undefined;
      this.loadState.run(() => this.getPost());
    });
  }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async getPost(): Promise<void> {
    const contents = await this.communityService.getPostContents(this.postId);
    this.applySubject(contents);
    await this.loadPage();
  }

  private applySubject(contents: PostContents): void {
    this.subjectName = this.topicId
      ? contents.topics.find((t) => t._id === this.topicId)?.name ?? contents.subject.name
      : contents.subject.name;
    const color = this.topicId
      ? contents.topics.find((t) => t._id === this.topicId)?.color ?? contents.subject.color
      : contents.subject.color;
    this.subjectIconUrl = getDefaultSubjectIconDataUrl(color);
  }

  async loadPage(): Promise<void> {
    const page = await this.communityService.getFlashcards(this.postId, this.pageSkip, this.pageSize, this.topicId);
    this.totalCount = page.count;
    this.pageFlashcards = page.data;
  }

  protected override onPageChange(): void {
    void this.loadPage();
  }

  isCorrectAnswer(card: Flashcard): boolean | undefined {
    return this.answersMap[card._id];
  }

  setAnswer(card: Flashcard, isCorrect: boolean): void {
    const wasAnswered = this.answersMap[card._id] !== undefined;
    const previousValue = this.answersMap[card._id];
    const newValue = previousValue === isCorrect ? undefined : isCorrect;

    if (newValue === undefined) {
      delete this.answersMap[card._id];
    } else {
      this.answersMap[card._id] = newValue;
    }

    if (wasAnswered && newValue === undefined) {
      this.answeredCount--;
      if (previousValue) this.correctCount--;
    } else if (!wasAnswered && newValue !== undefined) {
      this.answeredCount++;
      if (newValue) this.correctCount++;
    } else if (wasAnswered && newValue !== undefined && previousValue !== newValue) {
      this.correctCount += newValue ? 1 : -1;
    }
  }

  getCardColor(card: Flashcard): string {
    return cardView.getCardColor(card);
  }

  getCardTopicName(card: Flashcard): string {
    return cardView.getCardTopicName(card);
  }

  getCardBody(card: Flashcard): string {
    return cardView.getCardBody(card, this.showAnswerMap[card._id]);
  }

  getCardButtonText(card: Flashcard): string {
    return this.transloco.translate(this.showAnswerMap[card._id] ? 'test.runner.seeQuestion' : 'test.runner.seeAnswer');
  }

  seeAnswer(card: Flashcard): void {
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  get scoreMessage(): string {
    return this.transloco.translate('community.try.score', {
      correct: this.correctCount,
      answered: this.answeredCount,
    });
  }

  exitTry(): void {
    this.router.navigate(['/community']);
  }
}
