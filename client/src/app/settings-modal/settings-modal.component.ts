import { AppLanguage, storeLanguage } from '../shared/language';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '../shared/modal/modal.component';
import { ThemeService } from '../shared/theme/theme.service';
import { TutorialService } from '../shared/tutorial/tutorial.service';
import {
  DefaultTopicVisibility,
  defaultTopicVisibilityDefault,
  readDefaultTopicVisibility,
  storeDefaultTopicVisibility,
} from '../shared/default-topic-visibility';
import {
  DefaultFlashcardVisibility,
  defaultFlashcardVisibilityDefault,
  readDefaultFlashcardVisibility,
  storeDefaultFlashcardVisibility,
} from '../shared/default-flashcard-visibility';

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
          <span class="material-symbols-outlined">visibility</span>
          {{ 'settings.topicVisibility' | transloco }}
        </div>
        <app-searchable-select
          [options]="topicVisibilityOptions"
          [value]="topicVisibilityDefault"
          (valueChange)="setTopicVisibilityDefault($event)"
        ></app-searchable-select>
        <div class="settings-section-desc mt-2">{{ 'settings.topicVisibilityDesc' | transloco }}</div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span class="material-symbols-outlined">visibility</span>
          {{ 'settings.flashcardVisibility' | transloco }}
        </div>
        <app-searchable-select
          [options]="flashcardVisibilityOptions"
          [value]="flashcardVisibilityDefault"
          (valueChange)="setFlashcardVisibilityDefault($event)"
        ></app-searchable-select>
        <div class="settings-section-desc mt-2">{{ 'settings.flashcardVisibilityDesc' | transloco }}</div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span class="material-symbols-outlined">compare_arrows</span>
          {{ 'settings.importExport' | transloco }}
        </div>
        <button class="btn btn-outline-secondary w-100" (click)="openImportExport.emit()">
          <span class="material-symbols-outlined">upload_file</span>
          {{ 'settings.importExportButton' | transloco }}
        </button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span class="material-symbols-outlined">help</span>
          {{ 'settings.tutorial' | transloco }}
        </div>
        <button class="btn btn-outline-secondary w-100" (click)="showTutorial()">
          <span class="material-symbols-outlined">school</span>
          {{ 'settings.tutorialButton' | transloco }}
        </button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span class="material-symbols-outlined">feedback</span>
          {{ 'settings.feedback' | transloco }}
        </div>
        <a class="btn btn-outline-secondary w-100" [href]="feedbackUrl" target="_blank" rel="noopener noreferrer">
          <span class="material-symbols-outlined">send</span>
          {{ 'settings.feedbackButton' | transloco }}
        </a>
      </div>

      <ng-container modal-footer>
        <button type="button" class="btn btn-outline-secondary" (click)="cancel()"><span class="material-symbols-outlined">close</span>{{ 'settings.cancel' | transloco }}</button>
        <button type="button" class="btn btn-primary" (click)="save()"><span class="material-symbols-outlined">save</span>{{ 'settings.save' | transloco }}</button>
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
  topicVisibilityDefault: DefaultTopicVisibility = defaultTopicVisibilityDefault;
  flashcardVisibilityDefault: DefaultFlashcardVisibility = defaultFlashcardVisibilityDefault;

  readonly feedbackUrl = 'https://t.me/giadissima1234';

  readonly languageOptions: SelectOption[] = [
    { value: 'it', label: 'Italiano' },
    { value: 'en', label: 'English' },
  ];

  get topicVisibilityOptions(): SelectOption[] {
    return [
      { value: 'inherit', label: this.transloco.translate('visibility.inherit') },
      { value: 'public', label: this.transloco.translate('visibility.public') },
      { value: 'private', label: this.transloco.translate('visibility.private') },
    ];
  }

  get flashcardVisibilityOptions(): SelectOption[] {
    return [
      { value: 'inherit', label: this.transloco.translate('visibility.inheritFlashcard') },
      { value: 'public', label: this.transloco.translate('visibility.public') },
      { value: 'private', label: this.transloco.translate('visibility.private') },
    ];
  }

  private originalDarkMode = false;
  private originalLanguage: AppLanguage = 'it';
  private originalTopicVisibilityDefault: DefaultTopicVisibility = defaultTopicVisibilityDefault;
  private originalFlashcardVisibilityDefault: DefaultFlashcardVisibility = defaultFlashcardVisibilityDefault;

  constructor(
    private transloco: TranslocoService,
    private themeService: ThemeService,
    private tutorialService: TutorialService,
  ) {}

  ngOnInit(): void {
    this.isDarkMode = this.themeService.theme === 'dark';
    this.loadLanguage();
    this.topicVisibilityDefault = readDefaultTopicVisibility();
    this.flashcardVisibilityDefault = readDefaultFlashcardVisibility();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // On every opening, snapshot the current state so "Cancel" can restore it
    if (changes['isOpen'] && this.isOpen) {
      this.originalDarkMode = this.isDarkMode;
      this.originalLanguage = this.language;
      this.originalTopicVisibilityDefault = this.topicVisibilityDefault;
      this.originalFlashcardVisibilityDefault = this.flashcardVisibilityDefault;
    }
  }

  save(): void {
    this.themeService.persist();
    storeLanguage(this.language);
    storeDefaultTopicVisibility(this.topicVisibilityDefault);
    storeDefaultFlashcardVisibility(this.flashcardVisibilityDefault);
    this.closeModal();
  }

  cancel(): void {
    this.isDarkMode = this.originalDarkMode;
    this.language = this.originalLanguage;
    this.topicVisibilityDefault = this.originalTopicVisibilityDefault;
    this.flashcardVisibilityDefault = this.originalFlashcardVisibilityDefault;
    this.themeService.setTheme(this.isDarkMode ? 'dark' : 'light');
    this.transloco.setActiveLang(this.originalLanguage);
    this.closeModal();
  }

  setTopicVisibilityDefault(value: string | null | undefined): void {
    this.topicVisibilityDefault = (value as DefaultTopicVisibility) ?? defaultTopicVisibilityDefault;
  }

  setFlashcardVisibilityDefault(value: string | null | undefined): void {
    this.flashcardVisibilityDefault =
      (value as DefaultFlashcardVisibility) ?? defaultFlashcardVisibilityDefault;
  }

  // The theme is applied right away as a preview, but only written to
  // localStorage on "Save" (see save()/cancel())
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.themeService.setTheme(this.isDarkMode ? 'dark' : 'light');
  }

  // Closes settings first so the tutorial modal is not stacked behind it
  showTutorial(): void {
    this.closeModal();
    this.tutorialService.open();
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
