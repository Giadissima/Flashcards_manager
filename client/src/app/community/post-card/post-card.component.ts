import { Component, Input, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { CommunityService } from '../community.service';
import { FeedPost } from '../../models/post.dto';
import { Flashcard } from '../../models/flashcard.dto';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { TranslocoModule } from '@jsverse/transloco';
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
  imports: [CommonModule, TranslocoModule, KatexRendererPipe],
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

  constructor(private communityService: CommunityService) {}

  ngOnInit(): void {
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
