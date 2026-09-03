import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { ImportExportService } from './import-export.service';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { ToastService } from '../shared/toast/toast.service';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ModalComponent } from '../shared/modal/modal.component';
import { toSubjectOptions } from '../shared/select-options.util';

@Component({
  selector: 'app-import-export-modal',
  standalone: true,
  imports: [SearchableSelectComponent, TranslocoModule, ModalComponent],
  template: `
    <app-modal [isOpen]="isOpen" [title]="'importExport.title' | transloco" (closed)="close()" *transloco="let t">
      <ng-container modal-header-start>
        <button type="button" class="icon-btn" (click)="goBack()" [attr.aria-label]="t('importExport.backToSettings')">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
      </ng-container>

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
        <button class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" (click)="onExport()" [disabled]="isLoading">
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
        <button class="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2" (click)="onImport()" [disabled]="isLoading || !selectedFile">
          <span class="material-symbols-outlined">upload</span>
          {{ 'importExport.importButton' | transloco }}
        </button>
      </section>

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
  `]
})
export class ImportExportModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() back = new EventEmitter<void>();

  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;
  selectedFile: File | null = null;
  isLoading = false;

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
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
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  goBack() {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.back.emit();
  }

  async onExport() {
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

  async onImport() {
    if (!this.selectedFile) return;
    this.isLoading = true;
    try {
      const { imported, skipped } = await this.importExportService.import(this.selectedFile);
      const message = skipped > 0
        ? this.transloco.translate('importExport.toast.importCompleted', { imported, skipped })
        : this.transloco.translate('importExport.toast.importSuccess', { count: imported });
      this.toastService.show(message, 'success');
      this.close();
    } catch (error) {
      this.toastService.show(this.transloco.translate('importExport.toast.importFailed'), 'error');
    } finally {
      this.isLoading = false;
    }
  }
}
