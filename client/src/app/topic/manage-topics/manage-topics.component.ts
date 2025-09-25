import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../topic.service';
import { ToastService } from '../../toast/toast.service';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-manage-topics',
  standalone: true,
  imports: [CommonModule, Toast, FormsModule],
  templateUrl: './manage-topics.component.html',
  styleUrls: ['./manage-topics.component.scss']
})
export class ManageTopicsComponent implements OnInit {
  topics: Topic[] = [];
  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;

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
