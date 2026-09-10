import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ContentOverflowDirective } from '../../shared/content-overflow.directive';
import { AuthService } from '../../auth/auth.service';
import { CommunityService } from '../community.service';
import { FeedPost } from '../../models/post.dto';
import { Flashcard } from '../../models/flashcard.dto';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/modal/modal.component';
import { PostImportModalComponent } from '../post-import-modal/post-import-modal.component';
import { PostReportModalComponent, ReportKind } from '../post-report-modal/post-report-modal.component';
import { restrictionMessage, restrictionOf } from '../../shared/restriction';
import { PostComment } from '../../models/social.dto';
import { Question } from '../../models/test.dto';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { shuffle } from '../../shared/array.util';
import { TestService } from '../../test/test.service';
import { Topic } from '../../models/topic.dto';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import * as cardView from '../../shared/flashcard-view.util';
import { getAvatarUrl } from '../../shared/avatar/avatar.util';
import { getDefaultSubjectIconDataUrl } from '../../subject/subject-icon.util';
import { baseUrlAPI } from '../../../config/config';

/**
 * Width of one carousel card and the gap between two, in step with
 * .post-flashcard's flex-basis and .carousel-track's gap in the stylesheet.
 * Used only to work out how many fit; the layout itself is still CSS's.
 */
const cardWidthPx = 300;
const cardGapPx = 16;

/** Before the first measurement, and the floor a card is never asked below. */
const minCardsPerPage = 1;

/** How long to let a resize settle before refetching to the new count. */
const resizeDebounceMs = 200;

/** The beat between one card of a page coming in and the next one. */
const cardStaggerMs = 80;

/** How many comments are fetched at once, first time and every time after. */
const commentPageSize = 20;

/**
 * One post of the feed: who shared what, and a carousel over the flashcards it
 * covers.
 *
 * The cards are fetched a page at a time rather than with the post: a shared
 * subject can carry hundreds, and the feed would be paying for all of them on
 * every scroll.
 */
@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    KatexRendererPipe,
    ModalComponent,
    ContentOverflowDirective,
    PostImportModalComponent,
    PostReportModalComponent,
    SearchableSelectComponent,
    PaginationComponent,
  ],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) post!: FeedPost;
  /** Fired when the reader clicks the author's name, to filter the feed down to them. */
  @Output() authorSelected = new EventEmitter<string>();
  @ViewChild('track') private trackRef!: ElementRef<HTMLDivElement>;

  cards: Flashcard[] = [];
  /** Set while a like is in flight, so a double click cannot send two. */
  liking = false;
  loading = false;
  /** First card of the window currently shown. */
  skip = 0;
  /** Which way the last page was asked for, which is the way it comes in. */
  pageDirection: 'forward' | 'back' = 'forward';

  /**
   * How many cards a page holds - measured from the track's own width rather
   * than fixed, so a page is always exactly as many as fit whole. Without
   * this a page sized for a wide screen just spills off a narrower one,
   * cards cut at the edge or hidden behind a scroll nothing on screen hints
   * is there.
   */
  pageSize = 3;
  private resizeObserver?: ResizeObserver;
  private resizeTimeout?: ReturnType<typeof setTimeout>;
  /** Whether the track's width has been measured yet - see onTrackResize. */
  private measured = false;

  /**
   * The topics actually behind this post's cards, whole-subject shares
   * included - the header's own topics list is empty for those, but a reader
   * still wants to narrow the carousel down to one of the eight the subject
   * happens to hold.
   */
  topicOptions: { _id: string; name: string; color?: string; cardCount: number }[] = [];
  /** Null narrows to nothing - the whole carousel, as it is without a filter. */
  selectedTopicId: string | null = null;
  /** How many cards the current topic filter matches, for the pagination bar. */
  filteredCount = 0;

  // Both keyed by flashcard id: which answers the reader has opened out, and
  // which ones are long enough to be worth offering it on.
  private expandedMap: Record<string, boolean> = {};
  private overflowMap: Record<string, boolean> = {};

  /** Set while a test is being created, so a second click cannot start two. */
  startingTry = false;

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private testService: TestService,
    private toast: ToastService,
    private transloco: TranslocoService,
    private router: Router,
  ) {}

  /**
   * Starts a real test over the post's cards, narrowed to whatever topic the
   * carousel is currently filtered to, and drops it straight into the usual
   * runner - timer, random order and history included, the same as a test
   * built from the reader's own library.
   *
   * Unlike import, this works on the reader's own posts too: taking a test is
   * just studying, nothing is copied or changed either way. The cards stay
   * whoever's they were; only the flashcard_ids end up in a Test that is the
   * reader's own to keep or discard (see TestRunner.exitTest, which asks
   * which one when source_post_id is set).
   */
  async openTry(): Promise<void> {
    if (this.startingTry) return;

    this.startingTry = true;
    try {
      // Already accurate for whatever the carousel is currently filtered to
      // (see loadPage): the full set when there is no topic filter, and just
      // that topic's count when there is one.
      const count = this.filteredCount;
      if (!count) {
        this.toast.show(this.transloco.translate('community.tryDeckEmpty'), 'info');
        return;
      }

      const page = await this.communityService.getFlashcards(
        this.post._id,
        0,
        count,
        this.selectedTopicId ?? undefined,
      );
      const questions: Question[] = shuffle(page.data).map((card) => ({
        flashcard_id: card._id,
        topic_id: typeof card.topic_id === 'string' ? card.topic_id : (card.topic_id as Topic | undefined)?._id,
      }));

      const test = await this.testService.create({ questions, source_post_id: this.post._id });
      this.router.navigate(['/test', test._id]);
    } catch {
      this.toast.show(this.transloco.translate('community.tryDeckError'), 'error');
    } finally {
      this.startingTry = false;
    }
  }

  // The strip on top, the icon and the topic under the title: the same four
  // helpers the home grid and the test runner draw a card with.
  cardColor(card: Flashcard): string {
    return cardView.getCardColor(card);
  }

  cardTopicName(card: Flashcard): string {
    return cardView.getCardTopicName(card);
  }

  cardQuestion(card: Flashcard): string {
    return cardView.getCardBody(card, false);
  }

  cardAnswer(card: Flashcard): string {
    return cardView.getCardBody(card, true);
  }

  // Clamped until asked for: the cards of a page stand side by side, and one
  // long answer would otherwise set the height of the whole row.
  isClamped(card: Flashcard): boolean {
    return !this.expandedMap[card._id];
  }

  // The fade is only drawn when something is actually hidden behind it, or it
  // would veil the last line of an answer that fits.
  isCut(card: Flashcard): boolean {
    return this.isClamped(card) && !!this.overflowMap[card._id];
  }

  isExpanded(card: Flashcard): boolean {
    return !!this.expandedMap[card._id];
  }

  canExpand(card: Flashcard): boolean {
    return !!this.overflowMap[card._id];
  }

  onContentOverflow(card: Flashcard, overflows: boolean): void {
    // Only the clamped state measures anything: expanded, the container is as
    // tall as its content and would always report "fits", which would take the
    // collapse control away and clamp the card again on the next pass.
    if (!this.isClamped(card)) return;
    this.overflowMap[card._id] = overflows;
  }

  toggleExpanded(card: Flashcard): void {
    this.expandedMap[card._id] = !this.expandedMap[card._id];
  }

  /**
   * One entry per slot the current page leaves empty, so the last page keeps
   * the shape of a full one.
   *
   * Empty while a page is on its way, or the row would be redrawn short for a
   * moment on the way to a page that fills it.
   */
  get emptySlots(): number[] {
    if (this.loading || !this.cards.length) return [];
    return Array.from({ length: Math.max(0, this.pageSize - this.cards.length) });
  }

  /**
   * When each card of the new page starts coming in.
   *
   * Reversed when paging back, so the last card moves first: the slide is
   * sixteen pixels and the order the cards arrive in is what actually reads as
   * a direction, so a stagger fixed left to right would say "forward" over the
   * top of it whichever arrow was pressed.
   */
  cardDelay(index: number): number {
    const step = this.pageDirection === 'back' ? this.cards.length - 1 - index : index;
    // Never negative: the empty slots sit past the last card, and paging back
    // would count them below zero, which CSS reads as an animation already
    // half over.
    return Math.max(0, step) * cardStaggerMs;
  }

  /** Nobody imports or likes their own work, so both stay off their posts. */
  get isMine(): boolean {
    return this.authService.user?._id === this.post.author._id;
  }

  ngOnInit(): void {
    // Comes with the feed, so the button carries the number from the start;
    // opening them replaces it with what was actually fetched
    this.commentCount = this.post.commentCount;
    this.filteredCount = this.post.flashcardCount;
    // The first page waits for the resize observer's own first callback in
    // ngAfterViewInit: it is measured off the track's real width, which is
    // not reliably there to measure yet at this point.
    void this.loadTopicOptions();
  }

  ngAfterViewInit(): void {
    // No measurement here: on a device already at a narrow width, the track
    // can still report a width of 0 this early, before the browser's first
    // layout pass has settled - that used to leave pageSize at its default
    // of 3 until an actual resize came along to correct it. The observer's
    // own first callback fires once the track has a real, laid-out width, so
    // the first measurement and page load happen there instead.
    this.resizeObserver = new ResizeObserver(() => this.onTrackResize());
    this.resizeObserver.observe(this.trackRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeTimeout);
  }

  /** How many whole cards the track's current width has room for. */
  private measurePageSize(): number {
    const width = this.trackRef?.nativeElement.clientWidth;
    if (!width) return this.pageSize;
    return Math.max(minCardsPerPage, Math.floor((width + cardGapPx) / (cardWidthPx + cardGapPx)));
  }

  /**
   * Debounced: a window drag fires this many times a second, and each one
   * would otherwise be its own request for a page nobody stayed on long
   * enough to see.
   *
   * Not debounced the first time: that call is the observer reporting the
   * track's real width for the first time, which is also what the first
   * page load has been waiting on - delaying it would just be a blank
   * carousel for no reason.
   */
  private onTrackResize(): void {
    if (!this.measured) {
      this.measured = true;
      this.pageSize = this.measurePageSize();
      void this.loadPage(0);
      return;
    }

    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      const measured = this.measurePageSize();
      if (measured === this.pageSize) return;

      this.pageSize = measured;
      // The old skip is meaningless against a different page size - back to
      // the start rather than working out which of the new pages it falls in.
      void this.loadPage(0);
    }, resizeDebounceMs);
  }

  /**
   * Only worth a control past one topic: a post narrowed to a single one
   * already shows nothing else, and a whole subject shared as one topic is no
   * different from the reader's point of view.
   */
  get topicSelectOptions(): SelectOption[] {
    return this.topicOptions.map((topic) => ({
      value: topic._id,
      label: `${topic.name} (${topic.cardCount})`,
      color: topic.color,
    }));
  }

  get hasTopicFilter(): boolean {
    return this.topicOptions.length > 1;
  }

  private async loadTopicOptions(): Promise<void> {
    try {
      const contents = await this.communityService.getPostContents(this.post._id);
      this.topicOptions = contents.topics;
    } catch {
      // Nothing worth failing the whole card over: the carousel still works
      // without the filter, just unable to narrow itself down.
    }
  }

  onTopicFilterChange(topicId: string | null | undefined): void {
    this.selectedTopicId = topicId ?? null;
    this.pageDirection = 'forward';
    void this.loadPage(0);
  }

  get subjectIconUrl(): string {
    return this.post.subject.icon
      ? `${baseUrlAPI}file/${this.post.subject.icon}`
      : getDefaultSubjectIconDataUrl(this.post.subject.color);
  }

  get avatarUrl(): string {
    return getAvatarUrl(this.post.author);
  }

  searchAuthor(): void {
    this.authorSelected.emit(this.post.author.username);
  }

  /** "Materia - Argomento", or the subject alone when all of it is shared. */
  get heading(): string {
    if (this.post.wholeSubject || !this.post.topics.length) {
      return this.post.subject.name;
    }
    return `${this.post.subject.name} - ${this.post.topics.map((t) => t.name).join(', ')}`;
  }

  /**
   * Applied on screen before the server answers, and rolled back if it
   * refuses: a like that waits for a round trip feels broken, and the only
   * thing at stake is a number.
   *
   * Clicking the button already lit takes the like back. The server refuses
   * an author liking their own post as well, since a disabled button is a
   * courtesy and not a rule.
   */
  async toggleLike(): Promise<void> {
    if (this.liking || this.isMine) return;

    const previous = { liked: this.post.liked, likes: this.post.likes };
    const wanted = !this.post.liked;

    this.post.liked = wanted;
    this.post.likes += wanted ? 1 : -1;
    this.liking = true;
    try {
      await this.communityService.setLike(this.post._id, wanted);
    } catch {
      this.post.liked = previous.liked;
      this.post.likes = previous.likes;
    } finally {
      this.liking = false;
    }
  }

  /** Cards already taken, so the button does not invite a second useless click. */
  readonly importedIds = new Set<string>();

  // --------------------------------------------------------- the whole set

  importOpen = false;
  /** The one card being taken, or null when the whole set is. */
  importingCard: Flashcard | null = null;

  // --------------------------------------------------------------- reporting

  reportOpen = false;
  reportKind: ReportKind = 'post';
  reportTargetId = '';
  reportAuthorUsername = '';
  /** Set once this reader has reported it, so the flag says it has been. */
  reported = false;
  /** Same idea, one entry per comment already reported. */
  private readonly reportedCommentIds = new Set<string>();

  /**
   * Whoever may not report right now is told immediately: opening the dialog
   * only to have it fail on submit would say the same thing, a click later.
   *
   * Asked of the server fresh each time rather than read off the cached
   * profile: a restriction lifted by moderation only reaches that cache on
   * the next login, so trusting it would keep telling a pardoned account it
   * is still blocked until it happens to log in again.
   */
  private async blockedFromReporting(): Promise<boolean> {
    const fresh = await this.authService.fetchMe().catch(() => this.authService.user);
    const blocked = fresh?.reportBlocked;
    if (!blocked) return false;

    const message = restrictionMessage('report', blocked.until);
    this.toast.show(this.transloco.translate(message.key, message.params), 'error');
    return true;
  }

  async openReport(): Promise<void> {
    if (await this.blockedFromReporting()) return;

    this.reportKind = 'post';
    this.reportTargetId = this.post._id;
    this.reportAuthorUsername = this.post.author.username;
    this.reportOpen = true;
  }

  async openCommentReport(comment: PostComment): Promise<void> {
    if (await this.blockedFromReporting()) return;

    this.reportKind = 'comment';
    this.reportTargetId = comment._id;
    this.reportAuthorUsername = comment.user_id.username;
    this.reportOpen = true;
  }

  onReported(): void {
    if (this.reportKind === 'comment') this.reportedCommentIds.add(this.reportTargetId);
    else this.reported = true;
  }

  isCommentReported(comment: PostComment): boolean {
    return this.reportedCommentIds.has(comment._id);
  }

  openImport(): void {
    this.importingCard = null;
    this.importOpen = true;
  }

  /**
   * A card on its own goes through the same dialog as the set it belongs to.
   *
   * It used to be one click and done. What that click could not say is where
   * the card was going: it made a subject and a topic of the author's names
   * without asking, and the reader found out afterwards.
   */
  openCardImport(card: Flashcard): void {
    if (this.importedIds.has(card._id)) return;

    this.importingCard = card;
    this.importOpen = true;
  }

  /**
   * Every card of the post is now the reader's, as far as the buttons on them
   * are concerned: marking them here saves a row of "add" buttons that would
   * each answer "you already have this one".
   */
  onImported(): void {
    if (this.importingCard) this.importedIds.add(this.importingCard._id);
    else for (const card of this.cards) this.importedIds.add(card._id);
  }

  // ------------------------------------------------------------- comments

  comments: PostComment[] = [];
  commentCount = 0;
  commentsOpen = false;
  commentDraft = '';
  sendingComment = false;
  loadingOlderComments = false;

  /** There are older ones left when fewer are on screen than the post has. */
  get hasOlderComments(): boolean {
    return this.comments.length < this.commentCount;
  }

  /**
   * Fetches the page before the oldest one on screen and puts it on top.
   *
   * Backwards, unlike every other list in the app: a thread is opened at its
   * recent end, and going further is going back in time.
   */
  async loadOlderComments(): Promise<void> {
    if (this.loadingOlderComments || !this.hasOlderComments) return;

    this.loadingOlderComments = true;
    try {
      const page = await this.communityService.getComments(
        this.post._id,
        this.comments.length,
        commentPageSize,
      );
      this.comments = [...[...page.data].reverse(), ...this.comments];
      this.commentCount = page.count;
    } catch (error) {
      // A block on commenting says so in its own words, with the date it ends
      const blocked = restrictionOf(error);
      this.toast.show(
        blocked
          ? this.transloco.translate(blocked.key, blocked.params)
          : this.transloco.translate('community.commentError'),
        'error',
      );
    } finally {
      this.loadingOlderComments = false;
    }
  }

  async toggleComments(): Promise<void> {
    this.commentsOpen = !this.commentsOpen;
    // Fetched the first time they are opened: most posts are scrolled past
    // without ever being read
    if (this.commentsOpen && !this.comments.length) await this.loadComments();
  }

  async sendComment(): Promise<void> {
    const text = this.commentDraft.trim();
    if (text.length < 2 || this.sendingComment) return;

    this.sendingComment = true;
    try {
      await this.communityService.addComment(this.post._id, text);
      this.commentDraft = '';
      await this.loadComments();
    } catch (error) {
      // A block on commenting, or the flood limit, says so in its own words
      const blocked = restrictionOf(error);
      this.toast.show(
        blocked
          ? this.transloco.translate(blocked.key, blocked.params)
          : this.transloco.translate('community.commentError'),
        'error',
      );
    } finally {
      this.sendingComment = false;
    }
  }

  async removeComment(comment: PostComment): Promise<void> {
    try {
      await this.communityService.deleteComment(comment._id);
      await this.loadComments();
    } catch {
      this.toast.show(this.transloco.translate('community.commentError'), 'error');
    }
  }

  isMyComment(comment: PostComment): boolean {
    return this.authService.user?._id === comment.user_id._id;
  }

  private async loadComments(): Promise<void> {
    // As many as are already on screen, plus room for one just written: a
    // reload after posting would otherwise throw away the older ones that
    // were asked for.
    const limit = Math.max(commentPageSize, this.comments.length + 1);
    const page = await this.communityService.getComments(this.post._id, 0, limit);
    // Asked for newest first and shown the other way round: the page worth
    // having is the recent end of the thread, but an exchange is read
    // downwards, each line answering the one above it.
    this.comments = [...page.data].reverse();
    this.commentCount = page.count;
  }

  // ------------------------------------------------------------- feedback

  feedbackCard: Flashcard | null = null;
  feedbackDraft = '';
  sendingFeedback = false;

  openFeedback(card: Flashcard): void {
    this.feedbackCard = card;
    this.feedbackDraft = '';
  }

  closeFeedback(): void {
    this.feedbackCard = null;
  }

  async sendFeedback(): Promise<void> {
    const text = this.feedbackDraft.trim();
    if (!this.feedbackCard || text.length < 2 || this.sendingFeedback) return;

    this.sendingFeedback = true;
    try {
      await this.communityService.createFeedback(this.feedbackCard._id, text);
      this.toast.show(this.transloco.translate('community.feedbackSent'), 'success');
      this.closeFeedback();
    } catch (error) {
      // 409 is "you already reported this one", which is not a failure
      const already = (error as { status?: number })?.status === 409;
      const blocked = restrictionOf(error);
      this.toast.show(
        blocked
          ? this.transloco.translate(blocked.key, blocked.params)
          : this.transloco.translate(
              already ? 'community.feedbackAlready' : 'community.feedbackError',
            ),
        already ? 'info' : 'error',
      );
      if (already) this.closeFeedback();
    } finally {
      this.sendingFeedback = false;
    }
  }

  get canGoBack(): boolean {
    return this.skip > 0;
  }

  get canGoForward(): boolean {
    return this.skip + this.pageSize < this.filteredCount;
  }

  /** app-pagination counts from 1, the carousel skips from 0. */
  get currentPage(): number {
    return Math.floor(this.skip / this.pageSize) + 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCount / this.pageSize));
  }

  previous(): void {
    if (!this.canGoBack) return;

    this.pageDirection = 'back';
    void this.loadPage(Math.max(0, this.skip - this.pageSize));
  }

  next(): void {
    if (!this.canGoForward) return;

    this.pageDirection = 'forward';
    void this.loadPage(this.skip + this.pageSize);
  }

  private async loadPage(skip: number): Promise<void> {
    this.loading = true;
    try {
      const page = await this.communityService.getFlashcards(
        this.post._id,
        skip,
        this.pageSize,
        this.selectedTopicId ?? undefined,
      );
      this.cards = page.data;
      this.skip = skip;
      this.filteredCount = page.count;
      // The post's own total travels with the unfiltered page only: the
      // footer says how big the whole set is, which a topic filter narrows
      // the carousel around without shrinking.
      if (!this.selectedTopicId) this.post.flashcardCount = page.count;
    } catch {
      this.cards = [];
    } finally {
      this.loading = false;
    }
  }
}
