import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { ModalComponent } from '../modal/modal.component';
import { PendingButtonDirective } from '../pending-button.directive';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { ToastService } from '../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';

interface SubjectGroup {
  subject: Subject;
  topics: Topic[];
}

/**
 * Every subject and topic as a tree of checkboxes, for turning spaced
 * repetition on or off without leaving the page that is about to use it -
 * the same choice Manage Topics/Subjects offers row by row, gathered here
 * into one place a test can open itself.
 */
@Component({
  selector: 'app-sr-manage-modal',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ModalComponent, PendingButtonDirective],
  templateUrl: './sr-manage-modal.component.html',
  styleUrl: './sr-manage-modal.component.scss',
})
export class SrManageModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  loading = false;
  /** Set while a cancel is undoing the session's changes, so nothing else can be clicked meanwhile. */
  reverting = false;
  groups: SubjectGroup[] = [];

  /** The row currently applying a toggle ("subject:<id>" or "topic:<id>"), so a click cannot be doubled while it is in flight. */
  busyKey: string | null = null;

  /** Each topic's flag as it was when the dialog opened, so Cancel knows what to put back. */
  private initial = new Map<string, boolean>();

  constructor(
    private subjectService: SubjectService,
    private topicService: TopicService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const [subjects, topics] = await Promise.all([
        this.subjectService.getSelectableSubjects(),
        this.topicService.getSelectableTopics(),
      ]);
      this.groups = subjects
        .map((subject) => ({
          subject,
          topics: topics.filter((topic) => (topic.subject_id as Subject)?._id === subject._id),
        }))
        .filter((group) => group.topics.length > 0);

      this.initial = new Map();
      for (const group of this.groups) {
        for (const topic of group.topics) {
          if (topic._id) this.initial.set(topic._id, !!topic.in_spaced_repetition);
        }
      }
    } catch {
      this.toastService.show(this.transloco.translate('spacedRepetition.manage.loadError'), 'error');
    } finally {
      this.loading = false;
    }
  }

  allEnabled(group: SubjectGroup): boolean {
    return group.topics.every((topic) => topic.in_spaced_repetition);
  }

  someEnabled(group: SubjectGroup): boolean {
    return !this.allEnabled(group) && group.topics.some((topic) => topic.in_spaced_repetition);
  }

  isBusy(key: string): boolean {
    return this.busyKey === key;
  }

  async toggleSubject(group: SubjectGroup): Promise<void> {
    const id = group.subject._id;
    if (!id || this.busyKey) return;

    const enabled = !this.allEnabled(group);
    const key = `subject:${id}`;
    this.busyKey = key;
    try {
      await this.subjectService.setSpacedRepetition(id, enabled);
      group.topics.forEach((topic) => (topic.in_spaced_repetition = enabled));
    } catch {
      this.toastService.show(this.transloco.translate('spacedRepetition.toastError'), 'error');
    } finally {
      this.busyKey = null;
    }
  }

  async toggleTopic(topic: Topic): Promise<void> {
    const id = topic._id;
    if (!id || this.busyKey) return;

    const enabled = !topic.in_spaced_repetition;
    const key = `topic:${id}`;
    this.busyKey = key;
    try {
      await this.topicService.setSpacedRepetition(id, enabled);
      topic.in_spaced_repetition = enabled;
    } catch {
      this.toastService.show(this.transloco.translate('spacedRepetition.toastError'), 'error');
    } finally {
      this.busyKey = null;
    }
  }

  /** "Confirm": the changes already sent to the server as they were clicked stay as they are. */
  confirm(): void {
    this.finish();
  }

  /**
   * "Cancel", and every other way of closing the dialog (the header's X,
   * the backdrop, Escape) - all of them go through here, so leaving without
   * confirming always means leaving as it was found.
   */
  async cancel(): Promise<void> {
    if (this.reverting) return;
    await this.revertChanges();
    this.finish();
  }

  private finish(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.closed.emit();
  }

  private async revertChanges(): Promise<void> {
    const reverts: Promise<void>[] = [];
    for (const group of this.groups) {
      for (const topic of group.topics) {
        const id = topic._id;
        const original = id ? this.initial.get(id) : undefined;
        if (id && original !== undefined && original !== !!topic.in_spaced_repetition) {
          reverts.push(
            this.topicService.setSpacedRepetition(id, original).then(() => {
              topic.in_spaced_repetition = original;
            }),
          );
        }
      }
    }
    if (!reverts.length) return;

    this.reverting = true;
    try {
      await Promise.all(reverts);
    } catch {
      this.toastService.show(this.transloco.translate('spacedRepetition.toastError'), 'error');
    } finally {
      this.reverting = false;
    }
  }
}
