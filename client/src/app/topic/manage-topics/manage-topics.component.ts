import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { PaginatedList } from '../../shared/paginated-list';
import { toSubjectOptions } from '../../shared/select-options.util';
import { Router } from '@angular/router';
import { SearchInputComponent } from '../../shared/search-input/search-input.component';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-manage-topics',
  standalone: true,
  imports: [CommonModule, Toast, SearchInputComponent, SearchableSelectComponent, TranslocoModule],
  templateUrl: './manage-topics.component.html',
  styleUrls: ['./manage-topics.component.scss']
})
export class ManageTopicsComponent extends PaginatedList implements OnInit {
  topics: Topic[] = [];
  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;
  searchTerm = '';

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }
  constructor(
    private topicService: TopicService,
    private router: Router,
    private toastService: ToastService,
    private subjectService: SubjectService,
    private transloco: TranslocoService
  ) {
    super();
  }

  ngOnInit(): void {
    this.loadTopics();
    this.loadSubjects();
  }

  async loadSubjects() {
    try {
      this.subjects = await this.subjectService.getSelectableSubjects();
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(this.transloco.translate('topic.toast.subjectsLoadError'), 'error');
    }
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadTopics();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.onFilterChange();
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id ?? null;
    this.onFilterChange();
  }

  async loadTopics(): Promise<void> {
    try {
      const response = await this.topicService.getAllTopics({
        limit: this.pageSize,
        skip: this.pageSkip,
        sortDirection: 'asc',
        sortField: 'name',
        subject_id: this.selectedSubjectId || undefined,
        title: this.searchTerm.trim() || undefined
      });
      this.topics = response.data;
      this.totalCount = response.count;
    } catch (error) {
      this.toastService.show(this.transloco.translate('topic.toast.topicsLoadError'), 'error');
    }
  }

  protected override onPageChange(): void {
    this.loadTopics();
  }

  getSubjectName(subjectId: any): string {
    if (typeof subjectId === 'object' && subjectId !== null) {
      return subjectId.name;
    }
    return 'Unknown';
  }

  createTopic(): void {
    this.router.navigate(['/create-topic']);
  }

  editTopic(id?: string): void {
    this.router.navigate(['/edit-topic', id]);
  }

  async deleteTopic(id?: string): Promise<void> {
    if (!id) return;
    if (confirm(this.transloco.translate('topic.manage.deleteConfirm'))) {
      try {
        await this.topicService.deleteTopic(id);
        // Reload instead of filtering locally: skip/limit are resolved by the
        // server, so the page would otherwise show one item less than it should
        await this.loadTopics();
        this.toastService.show(this.transloco.translate('topic.toast.deleted'), 'success');
      } catch (error) {
        this.toastService.show(this.transloco.translate('topic.toast.deleteError'), 'error');
      }
    }
  }
}
