import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Subject } from '../models/subject.dto';
import { SubjectService } from './subject.service';
import { ToastService } from '../toast/toast.service';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-manage-subjects',
  standalone: true,
  imports: [CommonModule, Toast],
  templateUrl: './manage-subjects.component.html',
  styleUrls: ['./manage-subjects.component.scss']
})
export class ManageSubjectsComponent implements OnInit {
  subjects: Subject[] = [];

  constructor(
    private subjectService: SubjectService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSubjects();
  }

  async loadSubjects(): Promise<void> {
    try {
      const response = await this.subjectService.getAllSubjects({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc'
      });
      this.subjects = response.data;
    } catch (error) {
      this.toastService.show('Failed to load subjects', 'error');
    }
  }

  createSubject(): void {
    this.router.navigate(['/create-subject']);
  }

  editSubject(id?: string): void {
    if (id) {
      this.router.navigate(['/edit-subject', id]);
    }
  }

  async deleteSubject(id?: string): Promise<void> {
    if (!id) return;
    if (confirm('Are you sure you want to delete this subject?')) {
      try {
        await this.subjectService.deleteSubject(id);
        this.subjects = this.subjects.filter(s => s._id !== id);
        this.toastService.show('Subject deleted successfully', 'success');
      } catch (error) {
        this.toastService.show('Failed to delete subject', 'error');
      }
    }
  }
}
