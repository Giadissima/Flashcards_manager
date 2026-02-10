import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { Question, Test } from '../../models/test.dto';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { RandomCardFIlter } from '../../models/http.dto';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TestService } from '../test.service';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';

export function atLeastOneValidator(controls: string[]): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const hasValue = controls.some(controlName => !!group.get(controlName)?.value);
    return hasValue ? null : { atLeastOneRequired: true };
  };
}

@Component({
  selector: 'app-setup-test',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './setup-test.html',
  styleUrls: ['./setup-test.scss']
})
export class SetupTest implements OnInit {
  testForm: FormGroup;
  subjects: Subject[] = [];
  topics: Topic[] = [];
  allTopics: Topic[] = [];

  constructor(
    private fb: FormBuilder,
    private subjectService: SubjectService,
    private testService: TestService,
    private flashcardService: FlashcardService,
    private topicService: TopicService,
    private router: Router
  ) {
    this.testForm = this.fb.group({
      subject_id: [null],
      topic_id: [null],
      numFlashcard: [10, [Validators.required, Validators.min(1)]]
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
    });
  }

  async startTest(): Promise<void> {
    if (this.testForm.valid) {
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
      window.alert("Unable to create the test"); // TODO change in toast
      this.router.navigate(['']);
        }
      }
    }