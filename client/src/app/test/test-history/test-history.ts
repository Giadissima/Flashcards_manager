import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { ScoreBarComponent } from '../../shared/score-bar/score-bar.component';
import {
  SegmentedFilterComponent,
  SegmentedOption,
} from '../../shared/segmented-filter/segmented-filter.component';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../shared/searchable-select/searchable-select.component';
import { Test, TestStats } from '../../models/test.dto';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { CommonModule } from '@angular/common';
import { DurationPipe } from '../../pipes/duration.pipe';
import { FormsModule } from '@angular/forms';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PaginatedList } from '../../shared/paginated-list';
import { toSubjectOptions, toTopicOptions } from '../../shared/select-options.util';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TestService } from '../test.service';
import { getTestScore, getTestSubjectLabel } from '../test-view.util';
import { ToastService } from '../../shared/toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';

@Component({
  selector: 'app-test-history',
  standalone: true,
  imports: [
    CommonModule,
    DurationPipe,
    FormsModule,
    SearchableSelectComponent,
    TranslocoModule,
    PageCardComponent,
    PaginationComponent,
    FilterBarComponent,
    ScoreBarComponent,
    SegmentedFilterComponent,
  ],
  templateUrl: './test-history.html',
  styleUrl: './test-history.scss',
})
export class TestHistory extends PaginatedList implements OnInit, OnDestroy {
  constructor(
    private testService: TestService,
    private subjectService: SubjectService,
    private topicService: TopicService,
    private router: Router,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {
    super();
  }

  /* How long the row stays gone before the deletion is actually sent, and how
     long the toast offering to take it back is on screen: the same number, so
     the option disappears exactly when it stops being available. */
  private static readonly UNDO_WINDOW_MS = 5000;

  /* Tests taken off the list and not deleted on the server yet, by id, each
     with the timer that will delete it. They are held out of every page read
     while they wait, so a reload of the list does not put them back. */
  private pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();

  tests: Test[] = [];
  override pageSize = 20;
  stats: TestStats | null = null;

  /* The same stats without the status filter: they are what the three status
     choices are labelled with, so picking one must not empty the other two. */
  statusStats: TestStats | null = null;

  subjects: Subject[] = [];
  allTopics: Topic[] = [];
  topics: Topic[] = [];
  selectedSubjectId: string | null = null;
  selectedTopicId: string | null = null;
  onlyWrong = false;
  selectedStatus: string | null = null;

  get activeFilterCount(): number {
    return [
      this.selectedSubjectId,
      this.selectedTopicId,
      this.selectedStatus && this.selectedStatus !== 'all' ? this.selectedStatus : null,
      this.onlyWrong || null,
    ].filter(Boolean).length;
  }

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

  get topicOptions(): SelectOption[] {
    return toTopicOptions(this.topics);
  }

  ngOnInit(): void {
    this.loadTests();
    this.loadStats();
    this.loadSubjects();
    this.loadTopics();
  }
  /* Three fixed choices, all worth reading at a glance: a strip states them,
     where a select would hide two of the three behind a click. */
  get statusOptions(): SegmentedOption[] {
    const total = this.statusStats?.totalTests;
    const completed = this.statusStats?.completedTests;
    return [
      {
        value: 'all',
        label: this.transloco.translate('test.history.statusAll'),
        count: total,
      },
      {
        value: 'completed',
        label: this.transloco.translate('test.history.statusCompleted'),
        count: completed,
      },
      {
        value: 'inProgress',
        label: this.transloco.translate('test.history.statusToComplete'),
        count:
          total !== undefined && completed !== undefined
            ? total - completed
            : undefined,
      },
    ];
  }

  async loadSubjects(): Promise<void> {
    this.subjects = await this.subjectService.getSelectableSubjects();
  }

  async loadTopics(): Promise<void> {
    this.allTopics = await this.topicService.getSelectableTopics();
    this.topics = this.allTopics;
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id ?? null;
    this.topics = this.selectedSubjectId
      ? this.allTopics.filter(
          (t) => (t.subject_id as Subject)?._id === this.selectedSubjectId,
        )
      : this.allTopics;

    if (
      this.selectedTopicId &&
      !this.topics.some((t) => t._id === this.selectedTopicId)
    ) {
      this.selectedTopicId = null;
    }
    this.onFilterChange();
  }

  onTopicSelected(id: string | null | undefined): void {
    this.selectedTopicId = id ?? null;

    // Automatically picks the subject of the chosen topic, as in setup-test
    const topic = this.allTopics.find((t) => t._id === this.selectedTopicId);
    const subjectId = (topic?.subject_id as Subject | undefined)?._id;
    if (subjectId && subjectId !== this.selectedSubjectId) {
      this.selectedSubjectId = subjectId;
      this.topics = this.allTopics.filter(
        (t) => (t.subject_id as Subject)?._id === subjectId,
      );
    }
    this.onFilterChange();
  }

  onOnlyWrongChange(checked: boolean): void {
    this.onlyWrong = checked;
    this.onFilterChange();
  }

  onStatusChange(statusFilter: string | null | undefined): void {
    this.selectedStatus = statusFilter ?? 'all';
    this.onFilterChange();
  }

  private get activeFilters() {
    return {
      subject_id: this.selectedSubjectId || undefined,
      topic_id: this.selectedTopicId || undefined,
      onlyWrong: this.onlyWrong || undefined,
      completed:
        this.selectedStatus === 'completed'
          ? true
          : this.selectedStatus === 'inProgress'
            ? false
            : undefined,
    };
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadTests();
    this.loadStats();
  }

  loadStats(): void {
    const filters = this.activeFilters;
    this.testService.getStats(filters).then((stats) => {
      this.stats = stats;
      // With no status picked the two are the same request: the counts on the
      // strip come from the stats just read instead of asking for them again.
      if (filters.completed === undefined) this.statusStats = stats;
    });

    if (filters.completed !== undefined) {
      const { completed, ...withoutStatus } = filters;
      this.testService
        .getStats(withoutStatus)
        .then((stats) => (this.statusStats = stats));
    }
  }

  loadTests(): void {
    this.testService
      .getAll({
        sortField: 'updatedAt',
        sortDirection: 'desc',
        skip: this.pageSkip,
        limit: this.pageSize,
        ...this.activeFilters,
      })
      .then((data) => {
        this.tests = data.data.filter(
          (t) => !t._id || !this.pendingDeletions.has(t._id),
        );
        this.totalCount = data.count;
      });
  }

  protected override onPageChange(): void {
    this.loadTests();
  }

  getCorrectCount(test: Test): number {
    return getTestScore(test).correct;
  }

  getWrongCount(test: Test): number {
    return getTestScore(test).wrong;
  }

  /** "Subject · Topic", the line the result page puts in its own subtitle. */
  getSubjectLabel(test: Test): string {
    return getTestSubjectLabel(test, this.transloco);
  }

  openTest(test: Test): void {
    if (!test._id) return;
    this.router.navigate(['/test-result', test._id]);
  }

  // Resumes an unfinished test, even from another device, since the progress
  // lives on the server and not in the local state of the client
  resumeTest(test: Test): void {
    if (!test._id) return;
    this.router.navigate(['/test', test._id]);
  }

  // The row goes as soon as the button is pressed and the server is told only
  // once the window to take it back has passed: the deletion is what the user
  // asked for, so it is carried out without a dialog in the way, and undoing it
  // is putting a row back rather than rebuilding a test that no longer exists.
  deleteTest(test: Test): void {
    const id = test._id;
    if (!id) return;

    const index = this.tests.indexOf(test);
    this.tests = this.tests.filter((t) => t._id !== id);
    this.pendingDeletions.set(
      id,
      setTimeout(() => this.commitDelete(id), TestHistory.UNDO_WINDOW_MS),
    );

    this.toast.show(
      this.transloco.translate('test.history.toast.deleted'),
      'success',
      {
        actionLabel: this.transloco.translate('test.history.toast.undo'),
        onAction: () => this.undoDelete(test, index),
        // Closing the toast is deciding: the offer to take it back was the only
        // reason to wait, so the deletion is sent without sitting out the rest
        // of the window.
        onDismiss: () => this.commitDelete(id),
        duration: TestHistory.UNDO_WINDOW_MS,
      },
    );
  }

  private undoDelete(test: Test, index: number): void {
    const id = test._id;
    if (!id) return;
    const timer = this.pendingDeletions.get(id);
    // Nothing to take back: the window has passed and the test is already gone.
    if (timer === undefined) return;

    clearTimeout(timer);
    this.pendingDeletions.delete(id);
    // Back where it was, unless the list has been reloaded meanwhile and is
    // now shorter than it was.
    this.tests.splice(Math.min(index, this.tests.length), 0, test);
  }

  private async commitDelete(id: string): Promise<void> {
    const timer = this.pendingDeletions.get(id);
    // Already sent: the window can be closed early from the toast, and the
    // timer it was racing has to find nothing left to do.
    if (timer === undefined) return;
    clearTimeout(timer);
    this.pendingDeletions.delete(id);

    try {
      await this.testService.delete(id);
      // Deleting the last test of a page would otherwise leave the reader on a
      // page that no longer exists, empty and past the end of the list.
      if (this.tests.length === 0 && this.currentPage > 1) this.currentPage--;
      this.loadTests();
      this.loadStats();
    } catch (err) {
      console.error('Error deleting test', err);
      this.toast.show(
        this.transloco.translate('test.history.toast.deleteError'),
        'error',
      );
      // The row is on screen again: it was never deleted.
      this.loadTests();
    }
  }

  // Leaving the page closes the window early rather than cancelling it: the
  // user asked for the deletion and did not take it back, and a timer waiting
  // on a screen nobody is looking at would be lost to the first reload.
  ngOnDestroy(): void {
    for (const [id, timer] of this.pendingDeletions) {
      clearTimeout(timer);
      this.testService
        .delete(id)
        .catch((err) => console.error('Error deleting test', err));
    }
    this.pendingDeletions.clear();
  }

  // Closes an unfinished test without answering the remaining questions:
  // they stay blank, as if the test had been ended early. The same endpoint the
  // runner ends a test with, keeping the time already on the test.
  async stopTest(test: Test): Promise<void> {
    if (!test._id) return;
    try {
      await this.testService.completeTest(test._id, test.elapsed_time ?? 0);
      this.toast.show(
        this.transloco.translate('test.history.toast.terminated'),
        'success',
      );
      this.loadTests();
      this.loadStats();
    } catch (err) {
      console.error('Error stopping test', err);
      this.toast.show(
        this.transloco.translate('test.history.toast.terminateError'),
        'error',
      );
    }
  }
}
