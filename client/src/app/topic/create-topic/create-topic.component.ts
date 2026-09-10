import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../shared/modal/modal.component';
import { VisibilityToggleComponent } from '../../shared/visibility-toggle/visibility-toggle.component';
import { Visibility, defaultVisibility } from '../../models/visibility.dto';
import { NgxColorsComponent, NgxColorsTriggerDirective } from 'ngx-colors';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { TopicService } from '../topic.service';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TutorialService } from '../../shared/tutorial/tutorial.service';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../shared/searchable-select/searchable-select.component';
import { charMinLength, nameMaxLength } from '../../../config/config';
import { ThemeService } from '../../shared/theme/theme.service';
import { toSubjectOptions } from '../../shared/select-options.util';

@Component({
  selector: 'app-create-topic',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    SearchableSelectComponent,
    NgxColorsComponent,
    NgxColorsTriggerDirective,
    PageCardComponent,
    VisibilityToggleComponent,
    ModalComponent,
  ],
  templateUrl: './create-topic.component.html',
})
export class CreateTopicComponent implements OnInit {
  topicForm!: FormGroup;
  subjects: Subject[] = [];

  // A topic needs a subject to belong to, so without any subject yet the
  // form is blocked behind a modal pointing at "create subject" instead.
  showEmptyStateModal = false;

  // While true, an empty options list is a normal "still fetching" state, not
  // a broken select - see SearchableSelectComponent.isEmpty.
  subjectsLoading = true;

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

  get visibilityControl(): FormControl<Visibility> {
    return this.topicForm.get('visibility') as FormControl<Visibility>;
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private topicService: TopicService,
    private toastService: ToastService,
    private subjectService: SubjectService,
    private transloco: TranslocoService,
    private tutorialService: TutorialService,
    protected themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.topicForm = this.fb.group({
      visibility: [defaultVisibility as Visibility],
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

  closeEmptyStateModal(): void {
    this.showEmptyStateModal = false;
  }

  goToCreateSubject(): void {
    this.showEmptyStateModal = false;
    this.router.navigate(['/create-subject']);
  }

  reviewTutorial(): void {
    this.showEmptyStateModal = false;
    this.tutorialService.open();
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
    this.subjectsLoading = true;
    try {
      this.subjects = await this.subjectService.getSelectableSubjects();
      this.showEmptyStateModal = this.subjects.length === 0;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(
        this.transloco.translate('topic.toast.subjectsLoadError'),
        'error',
      );
    } finally {
      this.subjectsLoading = false;
    }
  }
}
