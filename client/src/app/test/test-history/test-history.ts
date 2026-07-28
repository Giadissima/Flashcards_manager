import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { DurationPipe } from '../../../pipes/duration.pipe';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Test, TestStats } from '../../models/test.dto';
import { TestService } from '../test.service';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getSubjectIconUrl } from '../../subject/subject-icon.util';

@Component({
  selector: 'app-test-history',
  standalone: true,
  imports: [CommonModule, RouterLink, DurationPipe, FormsModule, SearchableSelectComponent, TranslocoModule],
  templateUrl: './test-history.html',
  styleUrl: './test-history.scss',
})
export class TestHistory implements OnInit {
  tests: Test[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  stats: TestStats | null = null;

  subjects: Subject[] = [];
  allTopics: Topic[] = [];
  topics: Topic[] = [];
  selectedSubjectId: string | null = null;
  selectedTopicId: string | null = null;
  onlyWrong = false;
  selectedStatus: 'all' | 'completed' | 'inProgress' = 'all';

  get subjectOptions(): SelectOption[] {
    return this.subjects.map((s) => ({ value: s._id!, label: s.name, iconUrl: getSubjectIconUrl(s) }));
  }

  get topicOptions(): SelectOption[] {
    return this.topics.map((t) => ({ value: t._id!, label: t.name, color: t.color }));
  }

  constructor(
    private testService: TestService,
    private subjectService: SubjectService,
    private topicService: TopicService,
    private router: Router,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.loadTests();
    this.loadStats();
    this.loadSubjects();
    this.loadTopics();
  }

  async loadSubjects(): Promise<void> {
    const response = await this.subjectService.getAllSubjects({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' });
    this.subjects = response.data;
  }

  async loadTopics(): Promise<void> {
    const response = await this.topicService.getAllTopics({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' });
    this.allTopics = response.data;
    this.topics = response.data;
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id ?? null;
    this.topics = this.selectedSubjectId
      ? this.allTopics.filter((t) => (t.subject_id as Subject)?._id === this.selectedSubjectId)
      : this.allTopics;

    if (this.selectedTopicId && !this.topics.some((t) => t._id === this.selectedTopicId)) {
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
      this.topics = this.allTopics.filter((t) => (t.subject_id as Subject)?._id === subjectId);
    }
    this.onFilterChange();
  }

  onOnlyWrongChange(checked: boolean): void {
    this.onlyWrong = checked;
    this.onFilterChange();
  }

  onStatusChange(): void {
    this.onFilterChange();
  }

  private get activeFilters() {
    return {
      subject_id: this.selectedSubjectId || undefined,
      topic_id: this.selectedTopicId || undefined,
      onlyWrong: this.onlyWrong || undefined,
      completed:
        this.selectedStatus === 'completed' ? true : this.selectedStatus === 'inProgress' ? false : undefined,
    };
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadTests();
    this.loadStats();
  }

  loadStats(): void {
    this.testService.getStats(this.activeFilters).then((stats) => (this.stats = stats));
  }

  loadTests(): void {
    this.testService
      .getAll({
        sortField: 'updatedAt',
        sortDirection: 'desc',
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        ...this.activeFilters,
      })
      .then((data) => {
        this.tests = data.data;
        this.totalCount = data.count;
      });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.loadTests();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
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
      await this.testService.update(test._id, { ...test, completedAt: new Date() });
      this.toast.show(this.transloco.translate('test.history.toast.terminated'), 'success');
      this.loadTests();
      this.loadStats();
    } catch (err) {
      console.error('Error stopping test', err);
      this.toast.show(this.transloco.translate('test.history.toast.terminateError'), 'error');
    }
  }
}
