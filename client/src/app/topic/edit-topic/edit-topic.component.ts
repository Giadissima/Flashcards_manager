import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgxColorsComponent, NgxColorsTriggerDirective } from 'ngx-colors';
import { TopicService } from './../topic.service';
import { ToastService } from '../../toast/toast.service';
import { SubjectService } from '../../subject/subject.service';
import { Subject } from '../../models/subject.dto';

import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { Toast } from '../../toast/toast';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { charMinLength, nameMaxLength } from '../../../config/config';
import { ThemeService } from '../../shared/theme/theme.service';
import { toSubjectOptions } from '../../shared/select-options.util';

@Component({
  selector: 'app-edit-topic',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, Toast, TranslocoModule, SearchableSelectComponent, NgxColorsComponent, NgxColorsTriggerDirective, LoadStateComponent],
  templateUrl: './edit-topic.component.html',
})
export class EditTopicComponent implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  editForm!: FormGroup;
  topicId?: string;
  subjects: Subject[] = [];

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private topicService: TopicService,
    private router: Router,
    private toastService: ToastService,
    private subjectService: SubjectService,
    private transloco: TranslocoService,
    protected themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(nameMaxLength)]],
      color: ['#000000'],
      subject_id: ['', Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.topicId = id;
        this.loadState.run(() => this.loadTopicData(id));
      } else {
        this.router.navigate(['/not-found']);
      }
    });
    this.loadSubjects();
  }

  async loadSubjects() {
    try {
      this.subjects = await this.subjectService.getSelectableSubjects();
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(this.transloco.translate('topic.toast.subjectsLoadError'), 'error');
    }
  }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async loadTopicData(id: string): Promise<void> {
    const topic = await this.topicService.getTopicById(id);
    this.editForm.patchValue({
      name: topic.name,
      color: topic.color,
      subject_id: typeof topic.subject_id === 'string' ? '' : topic.subject_id._id
    });
  }

  async updateTopic(): Promise<void> {
    if (this.editForm.invalid || !this.topicId) {
      this.editForm.markAllAsTouched();
      return;
    }
    try {
      await this.topicService.updateTopic(this.topicId, this.editForm.value);
      this.toastService.show(this.transloco.translate('topic.toast.updated'), 'success');
      this.router.navigate(['/manage-topics']);
    } catch (error) {
      this.toastService.show(this.transloco.translate('topic.toast.updateError'), 'error');
    }
  }
}
