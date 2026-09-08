import { Component, Input, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ContentOverflowDirective } from '../../shared/content-overflow.directive';
import { AuthService } from '../../auth/auth.service';
import { CommunityService } from '../community.service';
import { FeedPost } from '../../models/post.dto';
import { Flashcard } from '../../models/flashcard.dto';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/modal/modal.component';
import { PostImportModalComponent } from '../post-import-modal/post-import-modal.component';
import { PostReportModalComponent } from '../post-report-modal/post-report-modal.component';
import { PostComment } from '../../models/social.dto';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import * as cardView from '../../shared/flashcard-view.util';
import { getAvatarUrl } from '../../shared/avatar/avatar.util';
import { getDefaultSubjectIconDataUrl } from '../../subject/subject-icon.util';
import { baseUrlAPI } from '../../../config/config';

/** How many cards the carousel holds at a time. */
const pageSize = 3;

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
  ],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent implements OnInit {
  @Input({ required: true }) post!: FeedPost;

  cards: Flashcard[] = [];
  /** Set while a like is in flight, so a double click cannot send two. */
  liking = false;
  loading = false;
  /** First card of the window currently shown. */
  skip = 0;
  /** Which way the last page was asked for, which is the way it comes in. */
  pageDirection: 'forward' | 'back' = 'forward';

  // Both keyed by flashcard id: which answers the reader has opened out, and
  // which ones are long enough to be worth offering it on.
  private expandedMap: Record<string, boolean> = {};
  private overflowMap: Record<string, boolean> = {};

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {}

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
    return Array.from({ length: Math.max(0, pageSize - this.cards.length) });
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
  reportOpen = false;
  /** Set once this reader has reported it, so the flag says it has been. */
  reported = false;
  /** The one card being taken, or null when the whole set is. */
  importingCard: Flashcard | null = null;

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
    } catch {
      this.toast.show(this.transloco.translate('community.commentError'), 'error');
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
    } catch {
      this.toast.show(this.transloco.translate('community.commentError'), 'error');
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
      this.toast.show(
        this.transloco.translate(already ? 'community.feedbackAlready' : 'community.feedbackError'),
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
    return this.skip + pageSize < this.post.flashcardCount;
  }

  previous(): void {
    if (!this.canGoBack) return;

    this.pageDirection = 'back';
    void this.loadPage(Math.max(0, this.skip - pageSize));
  }

  next(): void {
    if (!this.canGoForward) return;

    this.pageDirection = 'forward';
    void this.loadPage(this.skip + pageSize);
  }

  private async loadPage(skip: number): Promise<void> {
    this.loading = true;
    try {
      const page = await this.communityService.getFlashcards(this.post._id, skip, pageSize);
      this.cards = page.data;
      this.skip = skip;
      // The count travels with every page, so a card withdrawn since the feed
      // was drawn does not leave the arrows pointing at nothing
      this.post.flashcardCount = page.count;
    } catch {
      this.cards = [];
    } finally {
      this.loading = false;
    }
  }
}
