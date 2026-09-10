import { Component, OnInit, ViewChild } from '@angular/core';
import { restrictionOf } from '../../shared/restriction';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

import { CommonModule } from '@angular/common';
import { VisibilityButtonComponent } from '../../shared/visibility-toggle/visibility-button.component';
import { Visibility } from '../../models/visibility.dto';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ImageLightboxComponent } from '../../shared/image-lightbox/image-lightbox.component';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
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
  imports: [CommonModule, SearchInputComponent, TranslocoModule, ImageLightboxComponent, ZoomableImagesDirective, ConfirmDialogComponent, LoadStateComponent, PageCardComponent, PaginationComponent, VisibilityButtonComponent],
  templateUrl: './manage-subjects.component.html',
  styleUrls: ['./manage-subjects.component.scss']
})
export class ManageSubjectsComponent extends PaginatedList implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

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
    this.loadState.run(() => this.loadSubjects());
  }

  // Left to throw: the initial call goes through app-load-state (see
  // ngOnInit), which needs the rejection to tell an unreachable server apart
  // from an empty page. A filter, a page change or a reload after delete
  // already has a list on screen, so those catch it themselves and fall back
  // to a toast instead of replacing the list with the error block.
  async loadSubjects(): Promise<void> {
    const response = await this.subjectService.getAllSubjects({
      skip: this.pageSkip,
      limit: this.pageSize,
      sortField: 'name',
      sortDirection: 'asc',
      title: this.searchTerm.trim() || undefined
    });
    this.subjects = response.data;
    this.totalCount = response.count;
  }

  private reloadSubjects(): void {
    this.loadSubjects().catch(() => {
      this.toastService.show(this.transloco.translate('subject.toast.loadError'), 'error');
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.reloadSubjects();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.onFilterChange();
  }

  protected override onPageChange(): void {
    this.reloadSubjects();
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

  // How long the undo toast (and the row's actual removal) waits before the
  // delete - which cascades to every topic and flashcard of the subject, see
  // SubjectService.delete server side - is actually sent to the server.
  private static readonly deleteUndoDelayMs = 6000;
  private deleteUndoTimer: ReturnType<typeof setTimeout> | null = null;

  askDeleteSubject(id?: string): void {
    if (!id) return;
    this.pendingDeleteId = id;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.pendingDeleteId = null;
  }

  /**
   * The row leaves the list right away, but nothing reaches the server until
   * the undo toast times out unanswered: pressing undo before then cancels
   * the pending call outright, rather than undoing a cascade already done.
   */
  confirmDelete(): void {
    const id = this.pendingDeleteId;
    this.cancelDelete();
    if (!id) return;

    this.subjects = this.subjects.filter((s) => s._id !== id);

    if (this.deleteUndoTimer) clearTimeout(this.deleteUndoTimer);
    this.deleteUndoTimer = setTimeout(() => {
      this.deleteUndoTimer = null;
      this.performDelete(id);
    }, ManageSubjectsComponent.deleteUndoDelayMs);

    this.toastService.show(this.transloco.translate('subject.toast.deleted'), 'success', {
      actionLabel: this.transloco.translate('subject.toast.deleteUndo'),
      onAction: () => this.undoDelete(),
      // Closing the toast by hand is not the same as ignoring it: the undo
      // offer was only good while it was on screen, so dismissing it settles
      // the delete right away instead of leaving it ticking unseen.
      onDismiss: () => this.finalizeDelete(id),
      duration: ManageSubjectsComponent.deleteUndoDelayMs,
    });
  }

  private finalizeDelete(id: string): void {
    if (this.deleteUndoTimer) {
      clearTimeout(this.deleteUndoTimer);
      this.deleteUndoTimer = null;
    }
    this.performDelete(id);
  }

  private undoDelete(): void {
    if (this.deleteUndoTimer) {
      clearTimeout(this.deleteUndoTimer);
      this.deleteUndoTimer = null;
    }
    this.toastService.show(this.transloco.translate('subject.toast.deleteUndone'), 'success');
    // The row never actually left the server, so the list only has to be
    // read again to bring it back - skip/limit stay resolved server side.
    this.reloadSubjects();
  }

  private async performDelete(id: string): Promise<void> {
    try {
      await this.subjectService.deleteSubject(id);
    } catch (error) {
      console.error('Error deleting subject', error);
      this.toastService.show(this.transloco.translate('subject.toast.deleteError'), 'error');
      // The row was already taken off screen on confirmDelete(); if the
      // delete it was standing in for failed, the list has to be read again
      // to put it back.
      this.reloadSubjects();
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
