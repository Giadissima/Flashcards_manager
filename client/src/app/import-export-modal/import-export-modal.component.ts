import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ImportExportService } from './import-export.service';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { ToastService } from '../toast/toast.service';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { getSubjectIconUrl } from '../subject/subject-icon.util';

@Component({
  selector: 'app-import-export-modal',
  standalone: true,
  imports: [CommonModule, SearchableSelectComponent],
  template: `
    <div class="modal fade" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="icon-btn" (click)="goBack()" aria-label="Back to settings">
                <span class="material-symbols-outlined">arrow_back</span>
              </button>
              <h5 class="modal-title mb-0">Import / Export Flashcards</h5>
            </div>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>
          <div class="modal-body">
            <!-- Export Section -->
            <section class="mb-4">
              <h6>Export</h6>
              <div class="mb-3">
                <label class="form-label">Filter by Subject (Optional)</label>
                <app-searchable-select
                  [options]="subjectOptions"
                  [value]="selectedSubjectId"
                  allOptionLabel="All Subjects"
                  placeholder="All Subjects"
                  (valueChange)="selectedSubjectId = $event ?? null"
                ></app-searchable-select>
              </div>
              <button class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" (click)="onExport()" [disabled]="isLoading">
                <span class="material-symbols-outlined">download</span>
                Export to ZIP
              </button>
            </section>

            <hr>

            <!-- Import Section -->
            <section>
              <h6>Import</h6>
              <div class="mb-3">
                <label for="importFile" class="form-label">Select JSON or ZIP File</label>
                <input type="file" id="importFile" class="form-control" (change)="onFileSelected($event)" accept=".json,.zip">
              </div>
              <button class="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2" (click)="onImport()" [disabled]="isLoading || !selectedFile">
                <span class="material-symbols-outlined">upload</span>
                Import
              </button>
            </section>

            <div *ngIf="isLoading" class="text-center mt-3">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'" (click)="close()"></div>
  `,
  styles: [`
    .modal {
      background: rgba(0,0,0,0.5);
      z-index: 1055;
    }
    .modal-backdrop {
      z-index: 1050;
    }
    .modal.show {
      display: block;
    }
    .material-symbols-outlined {
      font-size: 20px;
    }
    h6 {
      font-weight: bold;
      margin-bottom: 1rem;
    }
    .modal-content {
      border-radius: 12px;
      border: none;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
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
    return this.subjects.map((s) => ({ value: s._id!, label: s.name, iconUrl: getSubjectIconUrl(s) }));
  }

  constructor(
    private importExportService: ImportExportService,
    private subjectService: SubjectService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadSubjects();
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({ 
        skip: 0, 
        limit: 50,
        sortField: '_id',
        sortDirection: 'asc'
      });
      this.subjects = response.data;
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
      this.toastService.show('Export successful!', 'success');
    } catch (error) {
      this.toastService.show('Export failed', 'error');
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
        ? `Import completed: ${imported} added, ${skipped} duplicates skipped.`
        : `Import successful! ${imported} flashcards added.`;
      this.toastService.show(message, 'success');
      this.close();
    } catch (error) {
      this.toastService.show('Import failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }
}
