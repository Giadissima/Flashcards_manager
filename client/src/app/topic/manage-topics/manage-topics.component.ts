import { Component, OnInit, ViewChild } from '@angular/core';
import { restrictionOf } from '../../shared/restriction';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

import { CommonModule } from '@angular/common';
import { VisibilityButtonComponent } from '../../shared/visibility-toggle/visibility-button.component';
import { Visibility } from '../../models/visibility.dto';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PaginatedList } from '../../shared/paginated-list';
import { toSubjectOptions } from '../../shared/select-options.util';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchInputComponent } from '../../shared/search-input/search-input.component';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { SrToggleButtonComponent } from '../../shared/sr-toggle-button/sr-toggle-button.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-manage-topics',
  standalone: true,
  imports: [CommonModule, SearchInputComponent, SearchableSelectComponent, TranslocoModule, ConfirmDialogComponent, LoadStateComponent, PageCardComponent, PaginationComponent, VisibilityButtonComponent, SrToggleButtonComponent],
  templateUrl: './manage-topics.component.html',
  styleUrls: ['./manage-topics.component.scss']
})
export class ManageTopicsComponent extends PaginatedList implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

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
    private activatedRoute: ActivatedRoute,
    private toastService: ToastService,
    private subjectService: SubjectService,
    private transloco: TranslocoService
  ) {
    super();
  }

  ngOnInit(): void {
    // Arriving from "manage subjects" with a subject clicked lands here with
    // its id in the query string, pre-filtering the list to that subject.
    this.selectedSubjectId = this.activatedRoute.snapshot.queryParamMap.get('subject_id') || null;
    this.loadState.run(() => this.loadTopics());
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
    this.reloadTopics();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.onFilterChange();
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id ?? null;
    this.onFilterChange();
  }

  // Left to throw: see the same note on loadSubjects in manage-subjects, its
  // twin - the initial call goes through app-load-state (ngOnInit), a filter/
  // page change/reload after delete already has a list on screen and catches
  // it itself via reloadTopics(), falling back to a toast.
  async loadTopics(): Promise<void> {
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
  }

  private reloadTopics(): void {
    this.loadTopics().catch(() => {
      this.toastService.show(this.transloco.translate('topic.toast.topicsLoadError'), 'error');
    });
  }

  protected override onPageChange(): void {
    this.reloadTopics();
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

  /** Clicking a topic row jumps to the home feed pre-filtered to that topic. */
  filterByTopic(id?: string): void {
    if (!id) return;
    this.router.navigate(['/home'], { queryParams: { topic_id: id } });
  }

  /** Which topic the confirmation dialog is currently asking about. */
  private pendingDeleteId: string | null = null;
  showDeleteConfirm = false;

  askDeleteTopic(id?: string): void {
    if (!id) return;
    this.pendingDeleteId = id;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.pendingDeleteId = null;
  }

  async confirmDelete(): Promise<void> {
    const id = this.pendingDeleteId;
    this.cancelDelete();
    if (!id) return;

    try {
      await this.topicService.deleteTopic(id);
      this.toastService.show(this.transloco.translate('topic.toast.deleted'), 'success');
    } catch (error) {
      console.error('Error deleting topic', error);
      this.toastService.show(this.transloco.translate('topic.toast.deleteError'), 'error');
      return;
    }

    // Reload instead of filtering locally: skip/limit are resolved by the
    // server, so the page would otherwise show one item less than it should.
    // Its own failure gets its own (topicsLoadError) toast, not deleteError's.
    this.reloadTopics();
  }

  /** The row whose visibility is being changed, so it cannot be clicked twice. */
  visibilityBusyId: string | undefined;

  /**
   * Applied to the row as soon as the server confirms, without reloading the
   * page: nothing else about the list has changed.
   */
  async onVisibilityToggled(item: Topic, visibility: Visibility): Promise<void> {
    if (!item._id || this.visibilityBusyId) return;

    this.visibilityBusyId = item._id;
    try {
      await this.topicService.setVisibility(item._id, visibility);
      item.visibility = visibility;
      this.toastService.show(
        this.transloco.translate(
          visibility === 'public' ? 'visibility.toastPublic' : 'visibility.toastPrivate',
        ),
        'success',
      );
    } catch (error) {
      // A block on publishing is not a failure to explain away: it has a
      // reason and a date, and both belong in the message.
      const blocked = restrictionOf(error);
      this.toastService.show(
        blocked
          ? this.transloco.translate(blocked.key, blocked.params)
          : this.transloco.translate('visibility.toastError'),
        'error',
      );
    } finally {
      this.visibilityBusyId = undefined;
    }
  }

  /** The row whose spaced-repetition flag is being changed. */
  srBusyId: string | undefined;

  async onSrToggled(item: Topic, enabled: boolean): Promise<void> {
    if (!item._id || this.srBusyId) return;

    this.srBusyId = item._id;
    try {
      await this.topicService.setSpacedRepetition(item._id, enabled);
      item.in_spaced_repetition = enabled;
      this.toastService.show(
        this.transloco.translate(
          enabled ? 'spacedRepetition.toastOn' : 'spacedRepetition.toastOff',
        ),
        'success',
      );
    } catch (error) {
      this.toastService.show(this.transloco.translate('spacedRepetition.toastError'), 'error');
    } finally {
      this.srBusyId = undefined;
    }
  }

}
