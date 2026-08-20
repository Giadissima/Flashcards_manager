import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CommonModule } from '@angular/common';
import { NgxColorsComponent, NgxColorsTriggerDirective } from 'ngx-colors';
import { TopicService } from '../topic.service';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../shared/searchable-select/searchable-select.component';
import { getSubjectIconUrl } from '../../subject/subject-icon.util';
import { charMinLength, nameMaxLength } from '../../../config/config';
import { ThemeService } from '../../shared/theme/theme.service';

@Component({
  selector: 'app-create-topic',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Toast,
    TranslocoModule,
    SearchableSelectComponent,
    NgxColorsComponent,
    NgxColorsTriggerDirective,
  ],
  templateUrl: './create-topic.component.html',
})
export class CreateTopicComponent implements OnInit {
  topicForm!: FormGroup;
  subjects: Subject[] = [];

  get subjectOptions(): SelectOption[] {
    return this.subjects.map((s) => ({
      value: s._id!,
      label: s.name,
      iconUrl: getSubjectIconUrl(s),
    }));
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private topicService: TopicService,
    private toastService: ToastService,
    private subjectService: SubjectService,
    private transloco: TranslocoService,
    protected themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.topicForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(charMinLength),
          Validators.maxLength(nameMaxLength),
        ],
      ],
      color: ['#75d2cb', Validators.required], // Default to black
      subject_id: [null], // Assuming subject_id is required
    });
    this.loadSubjects();
  }

  async createTopic(): Promise<void> {
    if (this.topicForm.invalid) {
      this.topicForm.markAllAsTouched();
      return;
    }

    try {
      await this.topicService.createTopic(this.topicForm.value);
      this.toastService.show(
        this.transloco.translate('topic.toast.created'),
        'success',
      );
      this.router.navigate(['/manage-topics']);
    } catch (error) {
      this.toastService.show(
        this.transloco.translate('topic.toast.createError'),
        'error',
      );
    }
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc',
      });
      this.subjects = response.data;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(
        this.transloco.translate('topic.toast.subjectsLoadError'),
        'error',
      );
    }
  }
}
