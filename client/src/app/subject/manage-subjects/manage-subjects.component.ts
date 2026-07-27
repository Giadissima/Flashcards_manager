import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from './../subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { getSubjectIconUrl } from '../subject-icon.util';

@Component({
  selector: 'app-manage-subjects',
  standalone: true,
  imports: [CommonModule, Toast],
  templateUrl: './manage-subjects.component.html',
  styleUrls: ['./manage-subjects.component.scss']
})
export class ManageSubjectsComponent implements OnInit {
  subjects: Subject[] = [];
  private expandedSubjectIds = new Set<string>();

  currentPage = 1;
  pageSize = 10;
  totalCount = 0;

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
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        sortField: 'name',
        sortDirection: 'asc'
      });
      this.subjects = response.data;
      this.totalCount = response.count;
    } catch (error) {
      this.toastService.show('Failed to load subjects', 'error');
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.loadSubjects();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.loadSubjects();
  }

  getIconUrl(subject: Subject): string {
    return getSubjectIconUrl(subject);
  }

  isDescriptionExpanded(id?: string): boolean {
    return !!id && this.expandedSubjectIds.has(id);
  }

  // vecchie materie salvate prima dell'editor TipTap possono avere desc a
  // null/undefined o la stringa letterale "null" (bug di FormData.append
  // con un valore undefined); qui si tratta tutto come "nessuna descrizione"
  hasDescription(subject: Subject): boolean {
    const desc = subject.desc;
    if (!desc || desc.trim().toLowerCase() === 'null') return false;
    const textOnly = desc.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0;
  }

  toggleDescription(id?: string): void {
    if (!id) return;
    if (this.expandedSubjectIds.has(id)) {
      this.expandedSubjectIds.delete(id);
    } else {
      this.expandedSubjectIds.add(id);
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
        // ricarica invece di filtrare in locale: skip/limit sono legati al
        // server, altrimenti la pagina mostrerebbe un elemento in meno del dovuto
        await this.loadSubjects();
        this.toastService.show('Subject deleted successfully', 'success');
      } catch (error) {
        this.toastService.show('Failed to delete subject', 'error');
      }
    }
  }
}
