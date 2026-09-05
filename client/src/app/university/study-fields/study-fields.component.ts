import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { courseOptionValue, toCourseOptions, toUniversityOptions } from '../../shared/select-options.util';

import { CommonModule } from '@angular/common';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UniversityService } from '../university.service';

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
  imports: [CommonModule, TranslocoModule, SearchableSelectComponent],
  templateUrl: './study-fields.component.html',
  styleUrl: './study-fields.component.scss',
})
export class StudyFieldsComponent implements OnInit {
  /** Read once, to fill the controls: later edits are reported through (valueChange). */
  @Input() value: StudyFields = emptyStudyFields();

  @Output() valueChange = new EventEmitter<StudyFields>();

  universityOptions: SelectOption[] = [];
  courseOptions: SelectOption[] = [];
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
    this.universityCode = this.value.universityCode;
    this.courseValue =
      this.value.course && this.value.courseKind
        ? `${this.value.courseKind}|${this.value.course}`
        : null;

    try {
      this.universityOptions = toUniversityOptions(await this.universityService.getUniversities());
    } catch {
      // An optional field is not worth blocking the page for: the selects stay
      // empty and everything else still works.
      this.toastService.show(this.transloco.translate('studyFields.universitiesError'), 'warning');
    }

    if (this.universityCode) await this.loadCourses(this.universityCode);
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
