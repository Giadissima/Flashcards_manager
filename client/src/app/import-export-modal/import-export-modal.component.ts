import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HttpErrorResponse } from '@angular/common/http';

import { ConflictAction, ConflictResolution, ImportExportService, ImportPreview, ImportResolutions } from './import-export.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { PendingButtonDirective } from '../shared/pending-button.directive';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { ToastService } from '../shared/toast/toast.service';
import { toSubjectOptions } from '../shared/select-options.util';

// Same bounds the server enforces on a subject / topic name
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 30;

interface ConflictRow {
  name: string;
  cards: number;
  action: ConflictAction;
  // What the user typed for the new name; only sent when action is 'rename'
  newName: string;
}

interface SubjectConflictRow extends ConflictRow {
  duplicates: number;
  topics: ConflictRow[];
}

@Component({
  selector: 'app-import-export-modal',
  standalone: true,
  imports: [SearchableSelectComponent, TranslocoModule, ModalComponent, PendingButtonDirective],
  template: `
    <app-modal [isOpen]="isOpen" [title]="'importExport.title' | transloco" (closed)="close()" *transloco="let t">
      <ng-container modal-header-start>
        <button type="button" class="icon-btn" (click)="goBack()" [attr.aria-label]="t('importExport.backToSettings')">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
      </ng-container>

      @if (step === 'select') {
      <!-- Export Section -->
      <section class="mb-4">
        <h6>{{ 'importExport.exportHeader' | transloco }}</h6>
        <div class="mb-3">
          <label class="form-label">{{ 'importExport.filterBySubject' | transloco }}</label>
          <app-searchable-select
            [options]="subjectOptions"
            [value]="selectedSubjectId"
            [allOptionLabel]="t('common.allSubjects')"
            [placeholder]="t('common.allSubjects')"
            (valueChange)="selectedSubjectId = $event ?? null"
          ></app-searchable-select>
        </div>
        <button class="btn btn-primary w-100" (click)="onExport()" [disabled]="isLoading" [appPendingButton]="isLoading">
          <span class="material-symbols-outlined">download</span>
          {{ 'importExport.exportButton' | transloco }}
        </button>
      </section>

      <hr>

      <!-- Import Section -->
      <section>
        <h6>{{ 'importExport.importHeader' | transloco }}</h6>
        <div class="mb-3">
          <label for="importFile" class="form-label">{{ 'importExport.selectFile' | transloco }}</label>
          <input type="file" id="importFile" class="form-control" (change)="onFileSelected($event)" accept=".json,.zip">
        </div>
        <button class="btn btn-success w-100" (click)="onImport()" [disabled]="isLoading || !selectedFile" [appPendingButton]="isLoading">
          <span class="material-symbols-outlined">upload</span>
          {{ 'importExport.importButton' | transloco }}
        </button>
      </section>
      } @else {
      <!-- Only reached when something in the file is already in the account -->
      <section>
        <h6>{{ 'importExport.conflicts.title' | transloco }}</h6>
        <p class="note">{{ 'importExport.conflicts.hint' | transloco }}</p>

        <div class="bulk">
          <span class="note">{{ 'importExport.conflicts.applyToAll' | transloco }}</span>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="applyToAll('merge')">
            {{ 'importExport.conflicts.merge' | transloco }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="applyToAll('rename')">
            {{ 'importExport.conflicts.rename' | transloco }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="applyToAll('skip')">
            {{ 'importExport.conflicts.skip' | transloco }}
          </button>
        </div>

        @for (subject of rows; track subject.name) {
        <div class="conflict">
          <div class="conflict-head">
            <span class="material-symbols-outlined" aria-hidden="true">folder</span>
            <strong>{{ subject.name }}</strong>
          </div>
          <p class="note">
            {{ 'importExport.conflicts.subjectInfo' | transloco:{ cards: subject.cards, duplicates: subject.duplicates } }}
          </p>
          <div class="conflict-choice">
            <select class="form-select" [value]="subject.action"
              [attr.aria-label]="t('importExport.conflicts.subjectChoice', { name: subject.name })"
              (change)="onActionChange(subject, $any($event.target).value)">
              <option value="merge">{{ 'importExport.conflicts.mergeSubject' | transloco }}</option>
              <option value="rename">{{ 'importExport.conflicts.renameSubject' | transloco }}</option>
              <option value="skip">{{ 'importExport.conflicts.skipSubject' | transloco }}</option>
            </select>
            @if (subject.action === 'rename') {
            <input type="text" class="form-control" [attr.maxlength]="nameMaxLength" [value]="subject.newName"
              [attr.aria-label]="t('importExport.conflicts.newName')"
              (input)="subject.newName = $any($event.target).value">
            }
          </div>
          @if (subject.action === 'rename' && !isValid(subject)) {
          <p class="note is-error">{{ 'importExport.conflicts.nameInvalid' | transloco }}</p>
          }

          <!-- The topics only clash inside a subject the cards are put into -->
          @if (subject.action === 'merge') {
          @for (topic of subject.topics; track topic.name) {
          <div class="conflict-topic">
            <div class="conflict-head">
              <span class="material-symbols-outlined" aria-hidden="true">label</span>
              <span>{{ topic.name }}</span>
              <span class="note">{{ 'importExport.conflicts.topicInfo' | transloco:{ cards: topic.cards } }}</span>
            </div>
            <div class="conflict-choice">
              <select class="form-select" [value]="topic.action"
                [attr.aria-label]="t('importExport.conflicts.topicChoice', { name: topic.name })"
                (change)="onActionChange(topic, $any($event.target).value)">
                <option value="merge">{{ 'importExport.conflicts.mergeTopic' | transloco }}</option>
                <option value="rename">{{ 'importExport.conflicts.renameTopic' | transloco }}</option>
                <option value="skip">{{ 'importExport.conflicts.skipTopic' | transloco }}</option>
              </select>
              @if (topic.action === 'rename') {
              <input type="text" class="form-control" [attr.maxlength]="nameMaxLength" [value]="topic.newName"
                [attr.aria-label]="t('importExport.conflicts.newName')"
                (input)="topic.newName = $any($event.target).value">
              }
            </div>
            @if (topic.action === 'rename' && !isValid(topic)) {
            <p class="note is-error">{{ 'importExport.conflicts.nameInvalid' | transloco }}</p>
            }
          </div>
          }
          }
        </div>
        }

        <div class="conflict-actions">
          <button type="button" class="btn btn-outline-primary" (click)="cancelResolving()" [disabled]="isLoading">
            <span class="material-symbols-outlined">arrow_back</span>
            {{ 'importExport.conflicts.back' | transloco }}
          </button>
          <button type="button" class="btn btn-success" (click)="onConfirmImport()" [disabled]="isLoading || !canConfirm" [appPendingButton]="isLoading">
            <span class="material-symbols-outlined">upload</span>
            {{ 'importExport.importButton' | transloco }}
          </button>
        </div>
      </section>
      }

      @if (isLoading) {
      <div class="text-center mt-3">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">{{ 'common.loading' | transloco }}</span>
        </div>
      </div>
      }
    </app-modal>
  `,
  styles: [`
    .material-symbols-outlined {
      font-size: 20px;
    }
    h6 {
      font-weight: bold;
      margin-bottom: 1rem;
    }
    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--header-color);
    }
    .icon-btn:hover {
      background-color: var(--secondary-color);
    }
    .note {
      font-size: 0.875rem;
      opacity: 0.8;
      margin-bottom: 0.5rem;
    }
    .note.is-error {
      color: var(--bs-danger, #dc3545);
      opacity: 1;
    }
    .bulk {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .bulk .note {
      margin-bottom: 0;
    }
    .conflict {
      border: 1px solid var(--secondary-color);
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .conflict-topic {
      margin-top: 0.75rem;
      padding-left: 1rem;
      border-left: 2px solid var(--secondary-color);
    }
    .conflict-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.25rem;
    }
    .conflict-head .note {
      margin-bottom: 0;
    }
    .conflict-choice {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .conflict-actions {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .conflict-actions .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
  `]
})
export class ImportExportModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() back = new EventEmitter<void>();

  readonly nameMaxLength = NAME_MAX_LENGTH;

  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;
  selectedFile: File | null = null;
  isLoading = false;

  // 'resolve' is shown only when the file holds something already in the account
  step: 'select' | 'resolve' = 'select';
  rows: SubjectConflictRow[] = [];

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

  get canConfirm(): boolean {
    return this.rows.every(
      (subject) =>
        this.isValid(subject) &&
        (subject.action !== 'merge' || subject.topics.every((topic) => this.isValid(topic))),
    );
  }

  constructor(
    private importExportService: ImportExportService,
    private subjectService: SubjectService,
    private toastService: ToastService,
    private transloco: TranslocoService
  ) {}

  ngOnInit() {
    this.loadSubjects();
  }

  async loadSubjects() {
    try {
      this.subjects = await this.subjectService.getSelectableSubjects();
    } catch (error) {
      console.error('Error loading subjects', error);
    }
  }

  close() {
    this.resetImport();
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  goBack() {
    this.resetImport();
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.back.emit();
  }

  async onExport() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const blob = await this.importExportService.export(this.selectedSubjectId || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcards_export_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      this.toastService.show(this.transloco.translate('importExport.toast.exportSuccess'), 'success');
    } catch (error) {
      this.toastService.show(this.transloco.translate('importExport.toast.exportFailed'), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  // Asks the server what the file clashes with: with nothing to ask the import
  // goes straight on, otherwise the user is shown the clashes first.
  async onImport() {
    if (!this.selectedFile || this.isLoading) return;
    this.isLoading = true;
    try {
      const preview = await this.importExportService.preview(this.selectedFile);
      if (preview.conflicts.length === 0) {
        await this.runImport();
        return;
      }
      this.startResolving(preview);
    } catch (error) {
      this.showImportError(error);
    } finally {
      this.isLoading = false;
    }
  }

  async onConfirmImport() {
    if (!this.selectedFile || this.isLoading || !this.canConfirm) return;
    this.isLoading = true;
    try {
      await this.runImport(this.buildResolutions());
    } catch (error) {
      this.showImportError(error);
    } finally {
      this.isLoading = false;
    }
  }

  cancelResolving() {
    this.step = 'select';
    this.rows = [];
  }

  onActionChange(row: ConflictRow, action: ConflictAction) {
    row.action = action;
  }

  applyToAll(action: ConflictAction) {
    for (const subject of this.rows) {
      subject.action = action;
      for (const topic of subject.topics) topic.action = action;
    }
  }

  // A rename has to be an actual new name: as long as it is the old one, or
  // out of bounds, the import would be refused.
  isValid(row: ConflictRow): boolean {
    if (row.action !== 'rename') return true;
    const name = row.newName.trim();
    return name.length >= NAME_MIN_LENGTH && name.length <= NAME_MAX_LENGTH && name !== row.name;
  }

  private startResolving(preview: ImportPreview) {
    this.rows = preview.conflicts.map((subject) => ({
      name: subject.name,
      cards: subject.cards,
      duplicates: subject.duplicates,
      action: 'merge',
      newName: this.suggestedName(subject.name),
      topics: subject.topics.map((topic) => ({
        name: topic.name,
        cards: topic.cards,
        action: 'merge',
        newName: this.suggestedName(topic.name),
      })),
    }));
    this.step = 'resolve';
  }

  private suggestedName(name: string): string {
    const suffix = ' (2)';
    return name.slice(0, NAME_MAX_LENGTH - suffix.length).trimEnd() + suffix;
  }

  // Object.fromEntries and not indexed assignment: the keys are names taken from
  // a file, and assigning to "__proto__" would not create a key at all.
  private buildResolutions(): ImportResolutions {
    const toResolution = (row: ConflictRow): ConflictResolution =>
      row.action === 'rename' ? { action: row.action, name: row.newName.trim() } : { action: row.action };

    return {
      subjects: Object.fromEntries(this.rows.map((subject) => [subject.name, toResolution(subject)])),
      topics: Object.fromEntries(
        this.rows
          .filter((subject) => subject.action === 'merge' && subject.topics.length)
          .map((subject) => [
            subject.name,
            Object.fromEntries(subject.topics.map((topic) => [topic.name, toResolution(topic)])),
          ]),
      ),
    };
  }

  private async runImport(resolutions?: ImportResolutions) {
    const { imported, skipped } = await this.importExportService.import(this.selectedFile as File, resolutions);
    const message = skipped > 0
      ? this.transloco.translate('importExport.toast.importCompleted', { imported, skipped })
      : this.transloco.translate('importExport.toast.importSuccess', { count: imported });
    this.toastService.show(message, 'success');
    this.close();
  }

  private showImportError(error: unknown) {
    // A 400 means the file itself is the problem (wrong format, corrupt
    // archive) - telling them to pick a valid export is something they can
    // act on, unlike the generic message, which fits an actual server failure.
    // A 409 is a new name that turned out to be taken: they stay on the
    // choices to pick another one.
    let key = 'importExport.toast.importFailed';
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) key = 'importExport.toast.invalidFile';
      else if (error.status === 409) key = 'importExport.toast.nameTaken';
    }
    this.toastService.show(this.transloco.translate(key), 'error');
  }

  private resetImport() {
    this.step = 'select';
    this.rows = [];
    this.selectedFile = null;
  }
}
