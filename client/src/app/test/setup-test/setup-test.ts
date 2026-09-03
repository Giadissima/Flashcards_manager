import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { Question } from '../../models/test.dto';

import { CommonModule } from '@angular/common';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { RandomCardFIlter } from '../../models/http.dto';
import { Router } from '@angular/router';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TestService } from '../test.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { toSubjectOptions, toTopicOptions } from '../../shared/select-options.util';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

// At least a subject or one chosen topic: a test needs something to draw from.
export function subjectOrTopicValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const subject = group.get('subject_id')?.value;
    const topics = (group.get('topic_ids') as FormArray | null)?.value ?? [];
    const hasTopic = topics.some((id: string | null) => !!id);
    return subject || hasTopic ? null : { atLeastOneRequired: true };
  };
}

@Component({
  selector: 'app-setup-test',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, SearchableSelectComponent, TranslocoModule, PageCardComponent],
  templateUrl: './setup-test.html',
  styleUrls: ['./setup-test.scss']
})
export class SetupTest implements OnInit {
  testForm: FormGroup;
  subjects: Subject[] = [];
  topics: Topic[] = [];
  allTopics: Topic[] = [];
  flashcardCount: number | null = null;

  get noFlashcardsAvailable(): boolean {
    return this.flashcardCount === 0;
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
    }, { validators: subjectOrTopicValidator() });
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

  async updateFlashcardCount(): Promise<void> {
    const subject_id = this.testForm.get('subject_id')?.value;
    const topic_ids = this.selectedTopicIds;
    if (!subject_id && !topic_ids.length) {
      this.flashcardCount = null;
      return;
    }
    this.flashcardCount = await this.flashcardService.count({ subject_id, topic_ids });
  }

  async setMaxQuestions(): Promise<void> {
    const subject_id = this.testForm.get('subject_id')?.value;
    const count = await this.flashcardService.count({ subject_id, topic_ids: this.selectedTopicIds });
    this.testForm.get('numFlashcard')?.setValue(Math.min(count, 1000) || 1);
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
    if (this.testForm.valid && !this.noFlashcardsAvailable) {
      const subject_id = this.testForm.get('subject_id')?.value;
      const numFlashcard = this.testForm.get('numFlashcard')?.value;
      const queryParams: RandomCardFIlter = { subject_id, topic_ids: this.selectedTopicIds, numFlashcard };

      await this.createTest(queryParams);
    }
  }

  async createTest(query: RandomCardFIlter): Promise<void> {
    try {
      const flashcards = await this.flashcardService.getRandom(query);
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
