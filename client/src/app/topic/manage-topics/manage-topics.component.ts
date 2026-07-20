import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../topic.service';

@Component({
  selector: 'app-manage-topics',
  standalone: true,
  imports: [CommonModule, Toast, FormsModule, SearchableSelectComponent],
  templateUrl: './manage-topics.component.html',
  styleUrls: ['./manage-topics.component.scss']
})
export class ManageTopicsComponent implements OnInit {
  topics: Topic[] = [];
  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;
// TODO far funzionare la search

  get subjectOptions(): SelectOption[] {
    return this.subjects.map((s) => ({ value: s._id!, label: s.name }));
  }
  constructor(
    private topicService: TopicService,
    private router: Router,
    private toastService: ToastService,
    private subjectService: SubjectService
  ) { }

  ngOnInit(): void {
    this.loadTopics();
    this.loadSubjects();
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' });
      this.subjects = response.data;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show('Failed to load subjects', 'error');
    }
  }

  onFilterChange() {
    this.loadTopics();
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id ?? null;
    this.onFilterChange();
  }

  async loadTopics(): Promise<void> {
    try {
      const response = await this.topicService.getAllTopics({
        limit: 50,
        skip: 0,
        sortDirection: 'asc',
        sortField: 'name',
        subject_id: this.selectedSubjectId || undefined
      });
      this.topics = response.data;
    } catch (error) {
      this.toastService.show('Failed to load topics', 'error');
    }
  }

  getSubjectName(subjectId: any): string {
    if (typeof subjectId === 'object' && subjectId !== null) {
      return subjectId.name;
    }
    return 'Unknown';
  }

  createTopic(): void {
    this.router.navigate(['/create-topic']);
  }

  editTopic(id?: string): void {
    this.router.navigate(['/edit-topic', id]);
  }

  async deleteTopic(id?: string): Promise<void> {
    if (!id) return;
    if (confirm('Are you sure you want to delete this topic?')) {
      try {
        await this.topicService.deleteTopic(id);
        this.topics = this.topics.filter(t => t._id !== id);
        this.toastService.show('Topic deleted successfully', 'success');
      } catch (error) {
        this.toastService.show('Failed to delete topic', 'error');
      }
    }
  }
}
