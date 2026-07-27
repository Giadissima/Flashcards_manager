import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';

export type AppLanguage = 'it' | 'en';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, SearchableSelectComponent, TranslocoModule],
  template: `
    <div class="modal fade" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ 'settings.title' | transloco }}</h5>
            <button type="button" class="btn-close" (click)="cancel()"></button>
          </div>
          <div class="modal-body">

            <div class="settings-section">
              <div class="settings-section-title">
                <span class="material-symbols-outlined">language</span>
                {{ 'settings.language' | transloco }}
              </div>
              <app-searchable-select
                [options]="languageOptions"
                [value]="language"
                (valueChange)="setLanguage($event)"
              ></app-searchable-select>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">
                <span class="material-symbols-outlined">dark_mode</span>
                {{ 'settings.darkMode' | transloco }}
              </div>
              <div class="d-flex align-items-center gap-2">
                <div class="form-check form-switch mb-0">
                  <input class="form-check-input" type="checkbox" role="switch" id="darkModeSwitch"
                    [checked]="isDarkMode" (change)="toggleTheme()">
                </div>
                <span class="settings-section-desc">{{ 'settings.darkModeDesc' | transloco }}</span>
              </div>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">
                <span class="material-symbols-outlined">compare_arrows</span>
                {{ 'settings.importExport' | transloco }}
              </div>
              <button class="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2" (click)="openImportExport.emit()">
                <span class="material-symbols-outlined">upload_file</span>
                {{ 'settings.importExportButton' | transloco }}
              </button>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" (click)="cancel()">{{ 'settings.cancel' | transloco }}</button>
            <button type="button" class="btn btn-primary" (click)="save()">{{ 'settings.save' | transloco }}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'" (click)="cancel()"></div>
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
    .modal-content {
      border-radius: 12px;
      border: none;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .settings-section {
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      padding: calc(var(--spacing-unit) * 2);
      margin-bottom: calc(var(--spacing-unit) * 2);
    }
    .settings-section:last-child {
      margin-bottom: 0;
    }
    .settings-section-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-unit);
      font-weight: 700;
      color: var(--header-color);
      margin-bottom: calc(var(--spacing-unit) * 1.5);
    }
    .settings-section-desc {
      color: var(--text-color);
      font-size: 0.9rem;
    }
  `]
})
export class SettingsModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() openImportExport = new EventEmitter<void>();

  isDarkMode = false;
  language: AppLanguage = 'it';

  readonly languageOptions: SelectOption[] = [
    { value: 'it', label: 'Italiano' },
    { value: 'en', label: 'English' },
  ];

  private originalDarkMode = false;
  private originalLanguage: AppLanguage = 'it';

  constructor(private transloco: TranslocoService) {}

  ngOnInit(): void {
    this.loadTheme();
    this.loadLanguage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // ad ogni apertura salva lo stato attuale, così "Annulla" può ripristinarlo
    if (changes['isOpen'] && this.isOpen) {
      this.originalDarkMode = this.isDarkMode;
      this.originalLanguage = this.language;
    }
  }

  save(): void {
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    localStorage.setItem('language', this.language);
    this.closeModal();
  }

  cancel(): void {
    this.isDarkMode = this.originalDarkMode;
    this.language = this.originalLanguage;
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
    this.transloco.setActiveLang(this.originalLanguage);
    this.closeModal();
  }

  // il tema viene applicato subito come anteprima, ma salvato in localStorage
  // solo al click su "Salva Modifiche" (vedi save()/cancel())
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
  }

  setLanguage(value: string | null | undefined): void {
    this.language = value === 'en' ? 'en' : 'it';
    this.transloco.setActiveLang(this.language);
  }

  private closeModal(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  private loadTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      this.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
  }

  private loadLanguage(): void {
    this.language = this.transloco.getActiveLang() === 'en' ? 'en' : 'it';
  }
}
