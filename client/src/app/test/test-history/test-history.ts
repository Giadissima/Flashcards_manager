import { Component, OnInit } from '@angular/core';
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
import { ToastService } from '../../toast/toast.service';
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
export class TestHistory extends PaginatedList implements OnInit {
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
        this.tests = data.data;
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
    return getTestSubjectLabel(test);
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

  // Closes an unfinished test without answering the remaining questions:
  // they stay blank, as if the test had been ended early
  async stopTest(test: Test): Promise<void> {
    if (!test._id) return;
    try {
      await this.testService.update(test._id, {
        ...test,
        completedAt: new Date(),
      });
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
