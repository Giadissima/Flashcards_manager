import { Component, Input, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ContentOverflowDirective } from '../../shared/content-overflow.directive';
import { AuthService } from '../../auth/auth.service';
import { CommunityService } from '../community.service';
import { FeedPost } from '../../models/post.dto';
import { Flashcard } from '../../models/flashcard.dto';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/modal/modal.component';
import { PostComment } from '../../models/social.dto';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getAvatarUrl } from '../../shared/avatar/avatar.util';
import { getDefaultSubjectIconDataUrl } from '../../subject/subject-icon.util';
import { baseUrlAPI } from '../../../config/config';

/** How many cards the carousel holds at a time. */
const pageSize = 3;

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
  ],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent implements OnInit {
  @Input({ required: true }) post!: FeedPost;

  cards: Flashcard[] = [];
  /** Set while a vote is in flight, so a double click cannot send two. */
  voting = false;
  loading = false;
  /** First card of the window currently shown. */
  skip = 0;

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

  // The answer is clamped until asked for: three cards sit side by side, and
  // one long answer would otherwise stretch the row it is in.
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

  onAnswerOverflow(card: Flashcard, overflows: boolean): void {
    // Only the clamped state measures anything: expanded, the container is as
    // tall as its content and would always report "fits", which would take the
    // collapse control away and clamp the card again on the next pass.
    if (!this.isClamped(card)) return;
    this.overflowMap[card._id] = overflows;
  }

  toggleAnswer(card: Flashcard): void {
    this.expandedMap[card._id] = !this.expandedMap[card._id];
  }

  /** Nobody imports their own work, so the button stays off their own posts. */
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
   * refuses: a vote that waits for a round trip feels broken, and the only
   * thing at stake is a number.
   */
  async castVote(value: number): Promise<void> {
    if (this.voting) return;

    const previous = { myVote: this.post.myVote, score: this.post.score };
    // Clicking the arrow already lit takes the vote back
    const wanted = this.post.myVote === value ? 0 : value;

    this.post.score += wanted - this.post.myVote;
    this.post.myVote = wanted;
    this.voting = true;
    try {
      await this.communityService.vote(this.post._id, wanted);
    } catch {
      this.post.myVote = previous.myVote;
      this.post.score = previous.score;
    } finally {
      this.voting = false;
    }
  }

  /** Cards already taken, so the button does not invite a second useless click. */
  readonly importedIds = new Set<string>();
  importingId: string | null = null;

  async importCard(card: Flashcard): Promise<void> {
    if (this.importingId || this.importedIds.has(card._id)) return;

    this.importingId = card._id;
    try {
      await this.communityService.importFlashcard(card._id);
      this.importedIds.add(card._id);
      this.toast.show(this.transloco.translate('community.imported'), 'success');
    } catch (error) {
      // 409 is the server saying it is already there, which is worth telling
      // apart from a real failure
      const already = (error as { status?: number })?.status === 409;
      this.toast.show(
        this.transloco.translate(already ? 'community.alreadyImported' : 'community.importError'),
        already ? 'info' : 'error',
      );
      if (already) this.importedIds.add(card._id);
    } finally {
      this.importingId = null;
    }
  }

  // ------------------------------------------------------------- comments

  comments: PostComment[] = [];
  commentCount = 0;
  commentsOpen = false;
  commentDraft = '';
  sendingComment = false;

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
    const page = await this.communityService.getComments(this.post._id, 0, 20);
    this.comments = page.data;
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
    if (this.canGoBack) void this.loadPage(Math.max(0, this.skip - pageSize));
  }

  next(): void {
    if (this.canGoForward) void this.loadPage(this.skip + pageSize);
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
