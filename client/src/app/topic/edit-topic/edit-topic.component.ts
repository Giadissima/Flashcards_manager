import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopicService } from './../topic.service';
import { ToastService } from '../../toast/toast.service';
import { SubjectService } from '../../subject/subject.service';
import { Subject } from '../../models/subject.dto';

import { Toast } from '../../toast/toast';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-edit-topic',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, Toast, TranslocoModule],
  templateUrl: './edit-topic.component.html',
  styleUrls: ['./edit-topic.component.scss']
})
export class EditTopicComponent implements OnInit {
  editForm!: FormGroup;
  topicId?: string;
  subjects: Subject[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private topicService: TopicService,
    private router: Router,
    private toastService: ToastService,
    private subjectService: SubjectService,
    private transloco: TranslocoService
  ) { }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#000000'],
      subject_id: ['', Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.topicId = id;
        this.loadTopicData(id);
      }
    });
    this.loadSubjects();
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' });
      this.subjects = response.data;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(this.transloco.translate('topic.toast.subjectsLoadError'), 'error');
    }
  }

  async loadTopicData(id: string): Promise<void> {
    try {
      const topic = await this.topicService.getTopicById(id);
      console.dir(topic);
      this.editForm.patchValue({
        name: topic.name,
        color: topic.color,
        subject_id: typeof topic.subject_id === 'string' ? '' : topic.subject_id._id
      });
    } catch (error) {
      this.toastService.show(this.transloco.translate('topic.toast.loadError'), 'error');
    }
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
