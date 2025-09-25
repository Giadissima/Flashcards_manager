import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';

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
    private topicService: TopicService,
    private router: Router
  ) {
    this.testForm = this.fb.group({
      subject_id: [null],
      topic_id: [null],
      num: [10, [Validators.required, Validators.min(1)]]
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

  startTest(): void {
    if (this.testForm.valid) {
      const { subject_id, topic_id, num } = this.testForm.value;
      const queryParams: any = { num };
      if (subject_id) {
        queryParams.subject_id = subject_id;
      }
      if (topic_id) {
        queryParams.topic_id = topic_id;
      }
      this.router.navigate(['/test-runner'], { queryParams });
    }
  }
}