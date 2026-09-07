import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { CommunityService } from '../community.service';
import { FeedPost, ImportCollision, ImportTopicMode, PostContents } from '../../models/post.dto';
import { Flashcard } from '../../models/flashcard.dto';
import { ModalComponent } from '../../shared/modal/modal.component';
import { Topic } from '../../models/topic.dto';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { ToastService } from '../../shared/toast/toast.service';
import { TopicService } from '../../topic/topic.service';

/** The value of the destination select that stands for "make me a new one". */
const newSubject = 'new';

/**
 * Where a whole shared set is taken in.
 *
 * Two questions, in the order they have to be answered: what to take, and
 * where to put it. The second one is the reason this is a dialog and not a
 * button - a set of two hundred cards lands in a library that is already
 * organised, and dropping it in under the author's own names would be
 * rearranging somebody else's shelf.
 */
@Component({
  selector: 'app-post-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, ModalComponent],
  templateUrl: './post-import-modal.component.html',
  styleUrl: './post-import-modal.component.scss',
})
export class PostImportModalComponent implements OnChanges {
  @Input({ required: true }) post!: FeedPost;
  /**
   * One card instead of the whole set, when the dialog was opened from a card.
   *
   * The same dialog and not a second one: where a card goes is the same
   * question as where a set goes, and the only part that falls away is the
   * choosing of what, which for one card has one answer.
   */
  @Input() card: Flashcard | null = null;
  @Input() isOpen = false;

  @Output() closed = new EventEmitter<void>();
  /** How many cards landed, so the post can say so and count them in. */
  @Output() done = new EventEmitter<number>();

  readonly newSubject = newSubject;

  contents: PostContents | null = null;
  loading = false;
  importing = false;

  // ------------------------------------------------------------ what to take
  /** Ticked topics, by id. */
  chosen = new Set<string>();

  // ------------------------------------------------------------- where it goes
  subjects: Subject[] = [];
  target: string = newSubject;
  subjectName = '';

  // ----------------------------------------------------------- and how it lands
  topicMode: ImportTopicMode = 'keep';
  topicName = '';
  onCollision: ImportCollision = 'merge';
  /** The name each colliding topic is to take, keyed by the author's topic id. */
  renames: Record<string, string> = {};

  /** The names already in use in the chosen subject, folded for comparison. */
  private takenNames = new Set<string>();

  constructor(
    private communityService: CommunityService,
    private subjectService: SubjectService,
    private topicService: TopicService,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) void this.load();
  }

  get isCard(): boolean {
    return !!this.card;
  }

  /** A set of one, described the way a post's contents are. */
  private cardContents(card: Flashcard): PostContents {
    const topic = typeof card.topic_id === 'string' ? undefined : (card.topic_id as Topic);
    return {
      subject: {
        _id: '',
        name: this.post.subject.name,
        color: this.post.subject.color,
      },
      topics: topic?._id
        ? [{ _id: topic._id, name: topic.name, color: topic.color, cardCount: 1 }]
        : [],
      total: topic?._id ? 1 : 0,
      alreadyImported: 0,
    };
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.contents = null;
    try {
      const [contents, subjects] = await Promise.all([
        this.card
          ? Promise.resolve(this.cardContents(this.card))
          : this.communityService.getPostContents(this.post._id),
        this.subjectService.getSelectableSubjects(),
      ]);
      this.contents = contents;
      this.subjects = subjects;

      // Everything ticked: somebody who opened this on a post wants the set,
      // and leaving a topic out is the exception
      this.chosen = new Set(contents.topics.map((topic) => topic._id));

      // A subject of their own by the same name is where these cards would go
      // if they took them one by one, so it is where the dialog opens
      const same = subjects.find(
        (subject) => subject.name.toLowerCase() === contents.subject.name.toLowerCase(),
      );
      this.target = same?._id ?? newSubject;
      this.subjectName = contents.subject.name;
      this.topicMode = 'keep';
      this.topicName = contents.subject.name;
      this.onCollision = 'merge';
      this.renames = {};
      await this.readTakenNames();
    } catch {
      this.toast.show(this.transloco.translate('community.importSet.error'), 'error');
      this.close();
    } finally {
      this.loading = false;
    }
  }

  // --------------------------------------------------------------- the tree

  get allChosen(): boolean {
    if (!this.contents) return false;
    return this.chosen.size === this.contents.topics.length;
  }

  get someChosen(): boolean {
    return !this.allChosen && this.selectedCount > 0;
  }

  toggleAll(): void {
    if (!this.contents) return;

    this.chosen = this.allChosen
      ? new Set()
      : new Set(this.contents.topics.map((t) => t._id));
  }

  isChosen(topicId: string): boolean {
    return this.chosen.has(topicId);
  }

  toggleTopic(topicId: string): void {
    // A new Set rather than add/delete in place: the getters below are read
    // from the template, and a mutated Set is the same object to Angular.
    const next = new Set(this.chosen);
    if (!next.delete(topicId)) next.add(topicId);
    this.chosen = next;
  }

  /** How many cards the ticks add up to, which is what the button counts. */
  get selectedCount(): number {
    if (!this.contents) return 0;

    return this.contents.topics
      .filter((topic) => this.chosen.has(topic._id))
      .reduce((sum, topic) => sum + topic.cardCount, 0);
  }

  // -------------------------------------------------------- where it goes

  get isNewSubject(): boolean {
    return this.target === newSubject;
  }

  async onTargetChange(value: string): Promise<void> {
    this.target = value;
    await this.readTakenNames();
  }

  onTopicModeChange(mode: ImportTopicMode): void {
    this.topicMode = mode;
  }

  /**
   * The topics of the chosen subject, which is what makes a name a collision.
   *
   * A brand new subject has none, so nothing can collide and the question is
   * never put.
   */
  private async readTakenNames(): Promise<void> {
    this.takenNames = new Set();
    if (this.isNewSubject) return;

    const topics = await this.topicService.getSelectableTopics(this.target);
    this.takenNames = new Set(topics.map((topic) => topic.name.toLowerCase()));
  }

  /** The topics being taken whose name is already on a topic of the reader's. */
  get collisions(): { _id: string; name: string }[] {
    if (!this.contents || this.topicMode !== 'keep') return [];

    return this.contents.topics.filter(
      (topic) => this.chosen.has(topic._id) && this.takenNames.has(topic.name.toLowerCase()),
    );
  }

  renameOf(topic: { _id: string; name: string }): string {
    return this.renames[topic._id] ?? `${topic.name} (2)`;
  }

  onRename(topicId: string, name: string): void {
    this.renames[topicId] = name;
  }

  // ------------------------------------------------------------- and go

  get canImport(): boolean {
    if (this.importing || !this.selectedCount) return false;
    if (this.isNewSubject && this.subjectName.trim().length < 2) return false;
    if (this.topicMode === 'single' && this.topicName.trim().length < 2) return false;
    if (this.onCollision === 'rename') {
      return this.collisions.every((topic) => this.renameOf(topic).trim().length >= 2);
    }
    return true;
  }

  async confirm(): Promise<void> {
    if (!this.canImport) return;

    this.importing = true;
    try {
      const target = {
        ...(this.isNewSubject
          ? { subjectName: this.subjectName.trim() }
          : { subjectId: this.target }),
        topicMode: this.topicMode,
        ...(this.topicMode === 'single' ? { topicName: this.topicName.trim() } : {}),
        ...(this.topicMode === 'keep'
          ? {
              onCollision: this.onCollision,
              ...(this.onCollision === 'rename'
                ? {
                    renames: this.collisions.map((topic) => ({
                      topicId: topic._id,
                      name: this.renameOf(topic).trim(),
                    })),
                  }
                : {}),
            }
          : {}),
      };

      // One card goes to its own endpoint, the set to the other; everything
      // asked above travels with either.
      if (this.card) {
        await this.communityService.importFlashcard(this.card._id, target);
        this.toast.show(this.transloco.translate('community.imported'), 'success');
        this.done.emit(1);
        this.close();
        return;
      }

      const result = await this.communityService.importPost(this.post._id, {
        ...target,
        topicIds: [...this.chosen],
      });

      // Nothing new is not a failure: it is the answer to "do I have these
      // already", and it is worth a different sentence
      this.toast.show(
        result.imported
          ? this.transloco.translate('community.importSet.done', { count: result.imported })
          : this.transloco.translate('community.importSet.doneNone'),
        result.imported ? 'success' : 'info',
      );
      this.done.emit(result.imported);
      this.close();
    } catch (error) {
      // Two different refusals share the 409, and which one it is follows from
      // what was asked: the name of a subject can be taken, and a card can
      // have been taken already.
      const clash = (error as { status?: number })?.status === 409;
      const key =
        clash && this.isNewSubject
          ? 'community.importSet.subjectTaken'
          : clash && this.card
            ? 'community.alreadyImported'
            : 'community.importSet.error';
      this.toast.show(this.transloco.translate(key), 'error');
    } finally {
      this.importing = false;
    }
  }

  close(): void {
    this.closed.emit();
  }
}
