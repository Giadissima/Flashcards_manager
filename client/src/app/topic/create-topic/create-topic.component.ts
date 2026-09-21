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
import { Visibility } from '../../models/visibility.dto';
import { Topic } from '../../models/topic.dto';
import { NgxColorsComponent, NgxColorsTriggerDirective } from 'ngx-colors';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PendingButtonDirective } from '../../shared/pending-button.directive';
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
import {
  DefaultTopicVisibility,
  readDefaultTopicVisibility,
  resolveDefaultTopicVisibility,
} from '../../shared/default-topic-visibility';

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
    PendingButtonDirective,
  ],
  templateUrl: './create-topic.component.html',
})
export class CreateTopicComponent implements OnInit {
  topicForm!: FormGroup;
  subjects: Subject[] = [];
  submitting = false;

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

  /**
   * Read once when the form opens: the settings modal is the only place this
   * changes, and re-reading mid-form would fight with whatever the toggle
   * currently shows.
   */
  private visibilityDefaultMode: DefaultTopicVisibility = 'inherit';

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
    this.visibilityDefaultMode = readDefaultTopicVisibility();
    this.topicForm = this.fb.group({
      visibility: [
        resolveDefaultTopicVisibility(this.visibilityDefaultMode, undefined) as Visibility,
      ],
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

  /**
   * "Inherit" (the settings default) is a moving target until a subject is
   * picked: once it is, the toggle jumps to match it - unless the visitor
   * already touched the toggle themselves, which always wins.
   */
  onSubjectChange(subjectId: string | null | undefined): void {
    this.topicForm.get('subject_id')?.setValue(subjectId);

    if (this.visibilityDefaultMode !== 'inherit' || this.visibilityControl.dirty) return;
    const subject = this.subjects.find((s) => s._id === subjectId);
    this.visibilityControl.setValue(
      resolveDefaultTopicVisibility('inherit', subject?.visibility),
    );
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
    if (this.topicForm.invalid || this.submitting) {
      this.topicForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    try {
      const { visibility, ...rest } = this.topicForm.value;
      // Untouched "inherit" is left unset rather than sent as whatever the
      // toggle happened to show before a subject was chosen: the server then
      // resolves it itself, which also covers the no-subject-yet case.
      const stillInheriting =
        this.visibilityDefaultMode === 'inherit' && !this.visibilityControl.dirty;
      const payload: Topic = {
        ...rest,
        visibility: stillInheriting ? undefined : visibility,
      };
      await this.topicService.createTopic(payload);
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
    } finally {
      this.submitting = false;
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
