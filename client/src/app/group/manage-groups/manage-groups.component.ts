import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Group } from '../../models/group.dto';
import { GroupService } from '../group.service';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-manage-groups',
  standalone: true,
  imports: [CommonModule, Toast, FormsModule],
  templateUrl: './manage-groups.component.html',
  styleUrls: ['./manage-groups.component.scss']
})
export class ManageGroupsComponent implements OnInit {
  groups: Group[] = [];
  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;

  constructor(
    private groupService: GroupService,
    private router: Router,
    private toastService: ToastService,
    private subjectService: SubjectService
  ) {}

  ngOnInit(): void {
    this.loadGroups();
    this.subjectService.getAllSubjects({
      sortField: '_id',
      sortDirection: 'asc',
      skip: 0,
      limit: 50
    }).then((data)=>this.subjects=data.data);
  }

  onFilterChange(): void {
    this.loadGroups();
  }

  async loadGroups(): Promise<void> {
    try {
      const response = await this.groupService.getAllGroups({
        skip: 0,
        limit: 50, // Adjust as needed
        sortField: 'name',
        sortDirection: 'asc',
        subject_id: this.selectedSubjectId || undefined
      });
      this.groups = response.data;
    } catch (error) {
      this.toastService.show('Failed to load groups', 'error');
    }
  }

  getSubjectName(subject: string | Subject): string {
    if (subject && typeof subject === 'object') {
      return subject.name;
    }
    return '';
  }

  createGroup(): void {
    this.router.navigate(['/create-group']);
  }

  editGroup(id?: string): void {
    if (id) {
      this.router.navigate(['/edit-group', id]);
    }
  }

  async deleteGroup(id?: string): Promise<void> {
    if (!id) return;
    if (confirm('Are you sure you want to delete this group?')) {
      try {
        await this.groupService.deleteGroup(id);
        this.groups = this.groups.filter(g => g._id !== id);
        this.toastService.show('Group deleted successfully', 'success');
      } catch (error) {
        this.toastService.show('Failed to delete group', 'error');
      }
    }
  }
}
