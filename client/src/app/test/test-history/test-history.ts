import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../shared/searchable-select/searchable-select.component';
import { Test, TestStats } from '../../models/test.dto';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { CommonModule } from '@angular/common';
import { DurationPipe } from '../../../pipes/duration.pipe';
import { FormsModule } from '@angular/forms';
import { PaginatedList } from '../../shared/paginated-list';
import { toSubjectOptions, toTopicOptions } from '../../shared/select-options.util';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TestService } from '../test.service';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';

@Component({
  selector: 'app-test-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DurationPipe,
    FormsModule,
    SearchableSelectComponent,
    TranslocoModule,
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

  subjects: Subject[] = [];
  allTopics: Topic[] = [];
  topics: Topic[] = [];
  selectedSubjectId: string | null = null;
  selectedTopicId: string | null = null;
  onlyWrong = false;
  selectedStatus: string | null = null;

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
  get statusOptions(): SelectOption[] {
    return [
      {
        value: 'completed',
        label: this.transloco.translate('test.history.statusCompleted'),
      },
      {
        value: 'inProgress',
        label: this.transloco.translate('test.history.statusToComplete'),
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

    // Seleziona in automatico la materia dell'argomento scelto, come in setup-test
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
    this.testService
      .getStats(this.activeFilters)
      .then((stats) => (this.stats = stats));
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
    return test.questions.filter((q) => q.is_correct === true).length;
  }

  getWrongCount(test: Test): number {
    return test.questions.filter((q) => q.is_correct === false).length;
  }

  openTest(test: Test): void {
    if (!test._id) return;
    this.router.navigate(['/test-result', test._id]);
  }

  // Riprende un test non concluso (anche da un altro dispositivo, dato che
  // il progresso vive sul server, non nello stato locale del client)
  resumeTest(test: Test): void {
    if (!test._id) return;
    this.router.navigate(['/test', test._id]);
  }

  // Chiude un test non concluso senza rispondere alle domande rimanenti
  // (restano "non date", come se il test fosse stato terminato in anticipo)
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
