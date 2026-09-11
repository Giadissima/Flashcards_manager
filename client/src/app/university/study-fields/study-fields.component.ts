import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { courseOptionValue, toCourseOptions, toUniversityOptions } from '../../shared/select-options.util';

import { CommonModule } from '@angular/common';
import { SearchInputComponent } from '../../shared/search-input/search-input.component';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { University } from '../../models/university.dto';
import { UniversityService } from '../university.service';

/** Lower-cased and stripped of diacritics, so "citta" also matches "Città". */
const normalize = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Where the user studies, as the registration and the profile both hold it. */
export interface StudyFields {
  universityCode: string | null;
  course: string | null;
  /** "Laurea", "Laurea Magistrale", ... - the name alone does not identify a course. */
  courseKind: string | null;
}

export const emptyStudyFields = (): StudyFields => ({
  universityCode: null,
  course: null,
  courseKind: null,
});

/**
 * The university and course pair, with the second dropdown filled from the
 * first. Shared by the registration form and the profile page: they ask the
 * very same question, and the loading, resetting and empty-list rules behind it
 * are not worth writing twice.
 */
@Component({
  selector: 'app-study-fields',
  standalone: true,
  imports: [CommonModule, TranslocoModule, SearchableSelectComponent, SearchInputComponent],
  templateUrl: './study-fields.component.html',
  styleUrl: './study-fields.component.scss',
})
export class StudyFieldsComponent implements OnInit, OnChanges {
  /**
   * Re-applied to the controls on every change, not just the first: both the
   * registration form and the profile page can still be fetching the account
   * when this component is created, so the real value often lands after
   * ngOnInit has already read an empty default - see ngOnChanges.
   */
  @Input() value: StudyFields = emptyStudyFields();

  /**
   * A form asks where somebody studies; a filter asks which corner of the
   * Community to look at. Same two dropdowns, but the filter has no reason to
   * explain itself.
   */
  @Input() variant: 'form' | 'filter' = 'form';

  @Output() valueChange = new EventEmitter<StudyFields>();

  /**
   * No "all universities" choice in the filter: the feed reads from one
   * university at a time, so leaving it unpicked - not an explicit "all" -
   * is what asks the reader to choose rather than showing everyone's posts.
   */
  get universityAllLabel(): string | null {
    return this.variant === 'filter' ? null : 'studyFields.clear';
  }

  get universityPlaceholderKey(): string {
    return this.variant === 'filter'
      ? 'studyFields.chooseUniversity'
      : 'studyFields.universityPlaceholder';
  }

  get courseAllLabel(): string {
    return this.variant === 'filter'
      ? 'studyFields.allCourses'
      : 'studyFields.clear';
  }

  /** Full list fetched once; universityOptions is its filtered view. */
  private universities: University[] = [];
  cityFilter = '';

  universityOptions: SelectOption[] = [];
  courseOptions: SelectOption[] = [];
  loadingUniversities = true;
  loadingCourses = false;
  /**
   * True once a university with no degree courses is picked: the post-graduate
   * institutions (Normale, Sant'Anna, SISSA...) have none in the ministry's
   * list, so the second field explains itself instead of sitting there empty.
   */
  universityHasNoCourses = false;

  universityCode: string | null = null;
  /** "kind|name", the shape the options carry - see courseOptionValue. */
  courseValue: string | null = null;

  constructor(
    private universityService: UniversityService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.universities = await this.universityService.getUniversities();
      this.applyCityFilter();
    } catch {
      // An optional field is not worth blocking the page for: the selects stay
      // empty and everything else still works.
      this.toastService.show(this.transloco.translate('studyFields.universitiesError'), 'warning');
    } finally {
      this.loadingUniversities = false;
    }
  }

  // Runs before ngOnInit on the first binding too, so the very first render
  // already has the right university/course instead of the empty default.
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) return;

    const incoming = changes['value'].currentValue as StudyFields;
    const universityCode = incoming.universityCode ?? null;
    const courseValue =
      incoming.course && incoming.courseKind ? `${incoming.courseKind}|${incoming.course}` : null;

    // Every (valueChange) most callers feed straight back into `value`, which
    // re-triggers this hook with the very value just emitted - skip it, or an
    // in-progress course load would be cancelled by its own result arriving.
    const isFirstChange = changes['value'].isFirstChange();
    if (!isFirstChange && universityCode === this.universityCode && courseValue === this.courseValue) return;

    const universityChanged = universityCode !== this.universityCode;
    this.universityCode = universityCode;
    this.courseValue = courseValue;
    this.applyCityFilter();

    if (universityChanged) {
      this.courseOptions = [];
      this.universityHasNoCourses = false;
      if (universityCode) {
        this.loadingCourses = true;
        void this.loadCourses(universityCode);
      } else {
        this.loadingCourses = false;
      }
    }
  }

  // Fired by the search button, Enter or the clear "X" - never on every
  // keystroke, matching every other search bar in the app.
  onCityFilterChange(cityFilter: string): void {
    this.cityFilter = cityFilter;
    this.applyCityFilter();
  }

  // Narrows the picked university down to a single city: the ministry's list
  // runs past a thousand names, no scrolling gets you to the right one fast.
  private applyCityFilter(): void {
    const filter = normalize(this.cityFilter.trim());
    let filtered = filter
      ? this.universities.filter((u) => normalize(u.city).includes(filter))
      : this.universities;

    // The already-picked university must stay in the list even if it does not
    // match the filter, or the select would show the placeholder instead of it.
    if (this.universityCode && !filtered.some((u) => u.code === this.universityCode)) {
      const selected = this.universities.find((u) => u.code === this.universityCode);
      if (selected) filtered = [selected, ...filtered];
    }

    this.universityOptions = toUniversityOptions(filtered);
  }

  async onUniversityChange(code: string | null | undefined): Promise<void> {
    this.universityCode = code ?? null;
    // The course belonged to the previous university: it cannot survive the change
    this.courseValue = null;
    this.courseOptions = [];
    this.universityHasNoCourses = false;

    if (this.universityCode) await this.loadCourses(this.universityCode);
    this.emit();
  }

  onCourseChange(value: string | null | undefined): void {
    this.courseValue = value ?? null;
    this.emit();
  }

  private async loadCourses(universityCode: string): Promise<void> {
    this.loadingCourses = true;
    try {
      const courses = await this.universityService.getCourses(universityCode);
      this.courseOptions = toCourseOptions(courses);
      this.universityHasNoCourses = courses.length === 0;
      // A course that is no longer offered would otherwise sit in the control
      // showing nothing but its raw value
      if (this.courseValue && !courses.some((c) => courseOptionValue(c) === this.courseValue)) {
        this.courseValue = null;
      }
    } catch {
      this.toastService.show(this.transloco.translate('studyFields.coursesError'), 'warning');
    } finally {
      this.loadingCourses = false;
    }
  }

  private emit(): void {
    const separator = this.courseValue?.indexOf('|') ?? -1;
    this.valueChange.emit({
      universityCode: this.universityCode,
      course: separator >= 0 ? this.courseValue!.slice(separator + 1) : null,
      courseKind: separator >= 0 ? this.courseValue!.slice(0, separator) : null,
    });
  }
}
