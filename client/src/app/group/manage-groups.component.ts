import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Group } from '../models/group.dto';
import { GroupService } from './group.service';
import { ToastService } from '../toast/toast.service';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-manage-groups',
  standalone: true,
  imports: [CommonModule, Toast],
  templateUrl: './manage-groups.component.html',
  styleUrls: ['./manage-groups.component.scss']
})
export class ManageGroupsComponent implements OnInit {
  groups: Group[] = [];

  constructor(
    private groupService: GroupService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  async loadGroups(): Promise<void> {
    try {
      const response = await this.groupService.getAllGroups({
        skip: 0,
        limit: 50, // Adjust as needed
        sortField: 'name',
        sortDirection: 'asc'
      });
      this.groups = response.data;
    } catch (error) {
      this.toastService.show('Failed to load groups', 'error');
    }
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
