import { Component, OnInit } from '@angular/core';
import { restrictionOf } from '../../shared/restriction';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

import { CommonModule } from '@angular/common';
import { VisibilityButtonComponent } from '../../shared/visibility-toggle/visibility-button.component';
import { Visibility } from '../../models/visibility.dto';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ImageLightboxComponent } from '../../shared/image-lightbox/image-lightbox.component';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PaginatedList } from '../../shared/paginated-list';
import { ZoomableImagesDirective } from '../../shared/zoomable-images.directive';
import { Router } from '@angular/router';
import { SearchInputComponent } from '../../shared/search-input/search-input.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from './../subject.service';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getSubjectIconUrl } from '../subject-icon.util';
import { hasHtmlContent } from '../../shared/html.util';

@Component({
  selector: 'app-manage-subjects',
  standalone: true,
  imports: [CommonModule, SearchInputComponent, TranslocoModule, ImageLightboxComponent, ZoomableImagesDirective, ConfirmDialogComponent, PageCardComponent, PaginationComponent, VisibilityButtonComponent],
  templateUrl: './manage-subjects.component.html',
  styleUrls: ['./manage-subjects.component.scss']
})
export class ManageSubjectsComponent extends PaginatedList implements OnInit {
  subjects: Subject[] = [];
  private expandedSubjectIds = new Set<string>();
  searchTerm = '';

  constructor(
    private subjectService: SubjectService,
    private router: Router,
    private toastService: ToastService,
    private transloco: TranslocoService
  ) {
    super();
  }

  ngOnInit(): void {
    this.loadSubjects();
  }

  async loadSubjects(): Promise<void> {
    try {
      const response = await this.subjectService.getAllSubjects({
        skip: this.pageSkip,
        limit: this.pageSize,
        sortField: 'name',
        sortDirection: 'asc',
        title: this.searchTerm.trim() || undefined
      });
      this.subjects = response.data;
      this.totalCount = response.count;
    } catch (error) {
      this.toastService.show(this.transloco.translate('subject.toast.loadError'), 'error');
    }
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadSubjects();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.onFilterChange();
  }

  protected override onPageChange(): void {
    this.loadSubjects();
  }

  getIconUrl(subject: Subject): string {
    return getSubjectIconUrl(subject);
  }

  isDescriptionExpanded(id?: string): boolean {
    return !!id && this.expandedSubjectIds.has(id);
  }

  // vecchie materie salvate prima dell'editor TipTap possono avere desc a
  // or to the literal string "null" (FormData.append stringifies undefined):
  // all of those count as "no description" here.
  hasDescription(subject: Subject): boolean {
    const desc = subject.desc;
    if (!desc || desc.trim().toLowerCase() === 'null') return false;
    return hasHtmlContent(desc);
  }

  toggleDescription(id?: string): void {
    if (!id) return;
    if (this.expandedSubjectIds.has(id)) {
      this.expandedSubjectIds.delete(id);
    } else {
      this.expandedSubjectIds.add(id);
    }
  }

  createSubject(): void {
    this.router.navigate(['/create-subject']);
  }

  editSubject(id?: string): void {
    if (id) {
      this.router.navigate(['/edit-subject', id]);
    }
  }

  /** Clicking a subject row jumps to "manage topics" pre-filtered to that subject. */
  filterBySubject(id?: string): void {
    if (!id) return;
    this.router.navigate(['/manage-topics'], { queryParams: { subject_id: id } });
  }

  /** Which subject the confirmation dialog is currently asking about. */
  private pendingDeleteId: string | null = null;
  showDeleteConfirm = false;

  askDeleteSubject(id?: string): void {
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
      await this.subjectService.deleteSubject(id);
      // Reload instead of filtering locally: skip/limit are resolved by the
      // server, so the page would otherwise show one item less than it should
      await this.loadSubjects();
      this.toastService.show(this.transloco.translate('subject.toast.deleted'), 'success');
    } catch (error) {
      console.error('Error deleting subject', error);
      this.toastService.show(this.transloco.translate('subject.toast.deleteError'), 'error');
    }
  }

  /** The row whose visibility is being changed, so it cannot be clicked twice. */
  visibilityBusyId: string | undefined;

  /**
   * Applied to the row as soon as the server confirms, without reloading the
   * page: nothing else about the list has changed.
   */
  async onVisibilityToggled(item: Subject, visibility: Visibility): Promise<void> {
    if (!item._id || this.visibilityBusyId) return;

    this.visibilityBusyId = item._id;
    try {
      await this.subjectService.setVisibility(item._id, visibility);
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

}
