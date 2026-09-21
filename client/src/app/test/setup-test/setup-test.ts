import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PendingButtonDirective } from '../../shared/pending-button.directive';
import { Question } from '../../models/test.dto';

import { CommonModule } from '@angular/common';
import { DateRange, DateRangeFilterComponent } from '../../shared/date-range-filter/date-range-filter.component';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { RandomCardFIlter } from '../../models/http.dto';
import { RandomFlashcard } from '../../models/flashcard.dto';
import { Router } from '@angular/router';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { SrManageModalComponent } from '../../shared/sr-manage-modal/sr-manage-modal.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TestService } from '../test.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { toSubjectOptions, toTopicOptions } from '../../shared/select-options.util';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/** The three ways a test can be built. */
export type TestMode = 'basic' | 'wrong' | 'daily';

// At least a subject or one chosen topic: a manual (basic) test needs
// something to draw from. "Wrong" and "daily" draw from a rule instead
// (weak cards / cards due today), so they may run on every subject at once
// and the requirement does not apply to them.
export function subjectOrTopicValidator(getMode: () => TestMode): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    if (getMode() !== 'basic') return null;
    const subject = group.get('subject_id')?.value;
    const topics = (group.get('topic_ids') as FormArray | null)?.value ?? [];
    const hasTopic = topics.some((id: string | null) => !!id);
    return subject || hasTopic ? null : { atLeastOneRequired: true };
  };
}

@Component({
  selector: 'app-setup-test',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, SearchableSelectComponent, TranslocoModule, PageCardComponent, DateRangeFilterComponent, SrManageModalComponent, PendingButtonDirective],
  templateUrl: './setup-test.html',
  styleUrls: ['./setup-test.scss']
})
export class SetupTest implements OnInit {
  testForm: FormGroup;
  subjects: Subject[] = [];
  topics: Topic[] = [];
  allTopics: Topic[] = [];
  flashcardCount: number | null = null;
  /** Guards startTest() against a second click/Enter while the test is being created. */
  startingTest = false;
  /** Guards setMaxQuestions() against a second click while the count is loading. */
  maxQuestionsLoading = false;

  /** Which of the three squares is selected; "basic" is today's plain manual test. */
  mode: TestMode = 'basic';

  /** Whether the "manage spaced repetition" tree dialog is open. */
  manageSrOpen = false;

  /** The two ends of the range cards are drawn from, as YYYY-MM-DD days; null is an open end. */
  dateFrom: string | null = null;
  dateTo: string | null = null;

  // Only "basic" draws a fixed count from an exact set the count endpoint
  // can size in advance; "wrong" and "daily" draw from a rule and are
  // capped by numFlashcard rather than blocked by a known-empty count.
  get noFlashcardsAvailable(): boolean {
    return this.mode === 'basic' && this.flashcardCount === 0;
  }

  selectMode(mode: TestMode): void {
    const previousMode = this.mode;
    this.mode = mode;

    // "daily" draws every due/overdue card by default: the count is
    // optional there, and left blank rather than defaulting to 10 like the
    // other modes. Switching back restores the usual required count.
    const numFlashcard = this.testForm.get('numFlashcard');
    if (mode === 'daily') {
      numFlashcard?.setValidators([Validators.min(1), Validators.max(1000)]);
      if (previousMode !== 'daily') numFlashcard?.setValue(null);
    } else {
      numFlashcard?.setValidators([Validators.required, Validators.min(1), Validators.max(1000)]);
      if (previousMode === 'daily' && !numFlashcard?.value) numFlashcard?.setValue(10);
    }
    numFlashcard?.updateValueAndValidity();

    // The group validator reads mode through the closure it was built with;
    // it has to be told to run again, or the switch would not be reflected
    // until some unrelated control change re-triggered validation on its own.
    this.testForm.updateValueAndValidity();
  }

  openManageSr(): void {
    this.manageSrOpen = true;
  }

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

  /** The topic controls, one per select on the page. */
  get topicControls(): FormArray {
    return this.testForm.get('topic_ids') as FormArray;
  }

  /** The topics actually chosen, without the empty rows. */
  get selectedTopicIds(): string[] {
    return this.topicControls.value.filter((id: string | null): id is string => !!id);
  }

  /** Whether another row can be added: only once every one on screen is used. */
  get canAddTopic(): boolean {
    const rows = this.topicControls;
    return rows.controls.every(c => !!c.value) && rows.length < this.topics.length;
  }

  constructor(
    private fb: FormBuilder,
    private subjectService: SubjectService,
    private testService: TestService,
    private flashcardService: FlashcardService,
    private topicService: TopicService,
    private router: Router,
    private transloco: TranslocoService,
    private toastService: ToastService
  ) {
    this.testForm = this.fb.group({
      subject_id: [null],
      // Always one row to start with, which doubles as "every topic" while empty.
      topic_ids: this.fb.array([this.fb.control<string | null>(null)]),
      numFlashcard: [10, [Validators.required, Validators.min(1), Validators.max(1000)]]
    }, { validators: subjectOrTopicValidator(() => this.mode) });
  }

  ngOnInit(): void {
    this.subjectService.getSelectableSubjects()
      .then(subjects => this.subjects = subjects);

    this.topicService.getSelectableTopics()
      .then(topics => {
        this.allTopics = topics;
        this.topics = topics;
      });

    this.testForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      if (subjectId) {
        this.topics = this.allTopics.filter(g => (g.subject_id as Subject)?._id === subjectId);
      } else {
        this.topics = this.allTopics;
      }
      // Topics of another subject cannot stay chosen once the subject changes.
      this.resetTopics();
      this.updateFlashcardCount();
    });
  }

  /**
   * The topics a given row may offer: those of the subject, minus the ones
   * already chosen in the other rows, so a topic cannot be added twice.
   */
  topicOptionsFor(index: number): SelectOption[] {
    const chosenElsewhere = new Set(
      this.topicControls.controls
        .filter((_, i) => i !== index)
        .map(c => c.value)
        .filter((id): id is string => !!id)
    );
    return toTopicOptions(this.topics.filter(t => !t._id || !chosenElsewhere.has(t._id)));
  }

  addTopic(): void {
    /* The trigger is a link, not a button: it cannot be truly disabled, so the
       guard lives here for the keyboard path. */
    if (!this.canAddTopic) {
      return;
    }
    this.topicControls.push(this.fb.control<string | null>(null));
  }

  removeTopic(index: number): void {
    this.topicControls.removeAt(index);
    this.testForm.updateValueAndValidity();
    this.updateFlashcardCount();
  }

  private resetTopics(): void {
    while (this.topicControls.length > 1) this.topicControls.removeAt(0);
    this.topicControls.at(0).setValue(null, { emitEvent: false });
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.testForm.get('subject_id')?.setValue(id ?? null);
  }

  onSelectBlur(controlName: 'subject_id'): void {
    this.testForm.get(controlName)?.markAsTouched();
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.updateFlashcardCount();
  }

  /** The date range as it goes on every request: an open end left out entirely. */
  private get dateFilter(): Pick<RandomCardFIlter, 'from' | 'to'> {
    return { from: this.dateFrom ?? undefined, to: this.dateTo ?? undefined };
  }

  async updateFlashcardCount(): Promise<void> {
    const subject_id = this.testForm.get('subject_id')?.value;
    const topic_ids = this.selectedTopicIds;
    if (!subject_id && !topic_ids.length) {
      this.flashcardCount = null;
      return;
    }
    this.flashcardCount = await this.flashcardService.count({ subject_id, topic_ids, ...this.dateFilter });
  }

  async setMaxQuestions(): Promise<void> {
    if (this.maxQuestionsLoading) return;
    this.maxQuestionsLoading = true;
    try {
      const subject_id = this.testForm.get('subject_id')?.value;
      const count = await this.flashcardService.count({ subject_id, topic_ids: this.selectedTopicIds, ...this.dateFilter });
      this.testForm.get('numFlashcard')?.setValue(Math.min(count, 1000) || 1);
    } finally {
      this.maxQuestionsLoading = false;
    }
  }

  incrementQuestions(): void {
    this.stepQuestions(1);
  }

  decrementQuestions(): void {
    this.stepQuestions(-1);
  }

  private stepQuestions(delta: number): void {
    const control = this.testForm.get('numFlashcard');
    const current = Number(control?.value) || 0;
    control?.setValue(Math.min(1000, Math.max(1, current + delta)));
  }

  onTopicSelected(index: number, id: string | null | undefined): void {
    this.topicControls.at(index).setValue(id ?? null);

    // Automatically picks the subject of the chosen topic, without emitting the
    // event: the subscription on subject_id would otherwise re-filter and clear
    // the topics that were just chosen.
    const topic = this.allTopics.find(t => t._id === id);
    const subjectId = (topic?.subject_id as Subject | undefined)?._id;
    if (subjectId && subjectId !== this.testForm.get('subject_id')?.value) {
      this.testForm.get('subject_id')?.setValue(subjectId, { emitEvent: false });
      this.topics = this.allTopics.filter(g => (g.subject_id as Subject)?._id === subjectId);
    }
    this.updateFlashcardCount();
  }

  async startTest(): Promise<void> {
    if (this.testForm.valid && !this.noFlashcardsAvailable && !this.startingTest) {
      const subject_id = this.testForm.get('subject_id')?.value;
      const numFlashcard = this.testForm.get('numFlashcard')?.value;
      const queryParams: RandomCardFIlter = {
        subject_id,
        topic_ids: this.selectedTopicIds,
        numFlashcard,
        ...this.dateFilter,
      };

      this.startingTest = true;
      try {
        await this.createTest(queryParams);
      } finally {
        this.startingTest = false;
      }
    }
  }

  /** Which endpoint the questions are drawn from, one per square. */
  private drawFlashcards(query: RandomCardFIlter): Promise<RandomFlashcard[]> {
    switch (this.mode) {
      case 'wrong':
        return this.flashcardService.getWeak(query);
      case 'daily':
        return this.flashcardService.getDue(query);
      default:
        return this.flashcardService.getRandom(query);
    }
  }

  async createTest(query: RandomCardFIlter): Promise<void> {
    try {
      const flashcards = await this.drawFlashcards(query);
      // "Wrong" and "daily" have no known size ahead of the draw (see
      // noFlashcardsAvailable): an empty result is discovered here instead,
      // and read as "nothing to review" rather than a failure. "Daily" gets
      // its own message pointing at the manager, since an empty draw there
      // almost always means nothing has been turned on yet.
      if (!flashcards.length) {
        const key = this.mode === 'daily' ? 'test.setup.noneToReviewDailyError' : 'test.setup.noneToReviewError';
        this.toastService.show(this.transloco.translate(key), 'error');
        return;
      }
      const questions: Question[] = flashcards.map(fc => ({
        flashcard_id: fc._id,
        topic_id: fc.topic_id,
      }));
      const test = await this.testService.create({questions});
      this.router.navigate(['/test', test!._id]);

    } catch (err: any) {
      console.error(err);
      this.toastService.show(this.transloco.translate('test.setup.createError'), 'error');
      this.router.navigate(['']);
    }
  }
}
