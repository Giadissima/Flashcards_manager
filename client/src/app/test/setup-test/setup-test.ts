import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { Question, Test } from '../../models/test.dto';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { RandomCardFIlter } from '../../models/http.dto';
import { Router } from '@angular/router';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TestService } from '../test.service';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getSubjectIconUrl } from '../../subject/subject-icon.util';

export function atLeastOneValidator(controls: string[]): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const hasValue = controls.some(controlName => !!group.get(controlName)?.value);
    return hasValue ? null : { atLeastOneRequired: true };
  };
}

@Component({
  selector: 'app-setup-test',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, SearchableSelectComponent, TranslocoModule],
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
    return this.subjects.map((s) => ({ value: s._id!, label: s.name, iconUrl: getSubjectIconUrl(s) }));
  }

  get topicOptions(): SelectOption[] {
    return this.topics.map((t) => ({ value: t._id!, label: t.name, color: t.color }));
  }

  constructor(
    private fb: FormBuilder,
    private subjectService: SubjectService,
    private testService: TestService,
    private flashcardService: FlashcardService,
    private topicService: TopicService,
    private router: Router,
    private transloco: TranslocoService
  ) {
    this.testForm = this.fb.group({
      subject_id: [null],
      topic_id: [null],
      numFlashcard: [10, [Validators.required, Validators.min(1), Validators.max(1000)]]
    }, { validators: atLeastOneValidator(['subject_id', 'topic_id']) });
  }

  ngOnInit(): void {
    this.subjectService.getAllSubjects({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' })
      .then(response => this.subjects = response.data);

    this.topicService.getAllTopics({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' })
      .then(response => {
        this.allTopics = response.data;
        this.topics = response.data;
      });

    this.testForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      if (subjectId) {
        this.topics = this.allTopics.filter(g => (g.subject_id as Subject)?._id === subjectId);
      } else {
        this.topics = this.allTopics;
      }
      this.testForm.get('topic_id')?.setValue(null);
      this.updateFlashcardCount();
    });
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.testForm.get('subject_id')?.setValue(id ?? null);
  }

  onSelectBlur(controlName: 'subject_id' | 'topic_id'): void {
    this.testForm.get(controlName)?.markAsTouched();
  }

  async updateFlashcardCount(): Promise<void> {
    const { subject_id, topic_id } = this.testForm.value;
    if (!subject_id && !topic_id) {
      this.flashcardCount = null;
      return;
    }
    this.flashcardCount = await this.flashcardService.count({ subject_id, topic_id });
  }

  async setMaxQuestions(): Promise<void> {
    const { subject_id, topic_id } = this.testForm.value;
    const count = await this.flashcardService.count({ subject_id, topic_id });
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

  onTopicSelected(id: string | null | undefined): void {
    this.testForm.get('topic_id')?.setValue(id ?? null);

    // Seleziona in automatico la materia del topic scelto, senza emettere l'evento:
    // altrimenti la subscription su subject_id rifiltrerebbe i topic e azzererebbe questa stessa selezione
    const topic = this.allTopics.find(t => t._id === id);
    const subjectId = (topic?.subject_id as Subject | undefined)?._id;
    if (subjectId) {
      this.testForm.get('subject_id')?.setValue(subjectId, { emitEvent: false });
    }
    this.updateFlashcardCount();
  }

  async startTest(): Promise<void> {
    if (this.testForm.valid && !this.noFlashcardsAvailable) {
      const { subject_id, topic_id, numFlashcard } = this.testForm.value;
      const queryParams: RandomCardFIlter = { subject_id, topic_id, numFlashcard };
      
      await this.createTest(queryParams);
    }
  }

  async createTest(query: RandomCardFIlter): Promise<void> {
    try {
      let flashcard: {_id:string}[] = await this.flashcardService.getRandom(query);
      const questions: Question[] = flashcard.map(fc => ({
        flashcard_id: fc._id,
      }));
      const test = await this.testService.create({questions});
      this.router.navigate(['/test', test!._id]);

    } catch (err: any) {
      console.error(err);
      window.alert(this.transloco.translate('test.setup.createError')); // TODO change in toast
      this.router.navigate(['']);
        }
      }
    }