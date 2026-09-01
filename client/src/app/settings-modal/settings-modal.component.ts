import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { ThemeService } from '../shared/theme/theme.service';
import { AppLanguage, storeLanguage } from '../shared/language';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, SearchableSelectComponent, TranslocoModule, ModalComponent],
  template: `
    <app-modal [isOpen]="isOpen" [title]="'settings.title' | transloco" [showFooter]="true" (closed)="cancel()">

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

      <ng-container modal-footer>
        <button type="button" class="btn btn-outline-secondary btn-with-icon" (click)="cancel()"><span class="material-symbols-outlined">close</span>{{ 'settings.cancel' | transloco }}</button>
        <button type="button" class="btn btn-primary btn-with-icon" (click)="save()"><span class="material-symbols-outlined">save</span>{{ 'settings.save' | transloco }}</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
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

  constructor(private transloco: TranslocoService, private themeService: ThemeService) {}

  ngOnInit(): void {
    this.isDarkMode = this.themeService.theme === 'dark';
    this.loadLanguage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // On every opening, snapshot the current state so "Cancel" can restore it
    if (changes['isOpen'] && this.isOpen) {
      this.originalDarkMode = this.isDarkMode;
      this.originalLanguage = this.language;
    }
  }

  save(): void {
    this.themeService.persist();
    storeLanguage(this.language);
    this.closeModal();
  }

  cancel(): void {
    this.isDarkMode = this.originalDarkMode;
    this.language = this.originalLanguage;
    this.themeService.setTheme(this.isDarkMode ? 'dark' : 'light');
    this.transloco.setActiveLang(this.originalLanguage);
    this.closeModal();
  }

  // The theme is applied right away as a preview, but only written to
  // localStorage on "Save" (see save()/cancel())
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.themeService.setTheme(this.isDarkMode ? 'dark' : 'light');
  }

  setLanguage(value: string | null | undefined): void {
    this.language = value === 'en' ? 'en' : 'it';
    this.transloco.setActiveLang(this.language);
  }

  private closeModal(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

  private loadLanguage(): void {
    this.language = this.transloco.getActiveLang() === 'en' ? 'en' : 'it';
  }
}
