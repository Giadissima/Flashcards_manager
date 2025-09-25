import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { TopicService } from '../topic.service';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-create-topic',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './create-topic.component.html',
  styleUrls: ['./create-topic.component.scss']
})
export class CreateTopicComponent implements OnInit {
  topicForm!: FormGroup;
  subjects: Subject[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private topicService: TopicService,
    private toastService: ToastService,
    private subjectService: SubjectService
  ) {}

  ngOnInit(): void {
    this.topicForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#75d2cb', Validators.required], // Default to black
      subject_id: [null] // Assuming subject_id is required
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
      this.toastService.show('Topic created successfully', 'success');
      this.router.navigate(['/manage-topics']);
    } catch (error) {
      this.toastService.show('Failed to create topic', 'error');
    }
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc'
      });
      this.subjects = response.data;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show('Failed to load subjects', 'error');
    }
  }
}
