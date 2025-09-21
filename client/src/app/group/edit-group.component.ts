import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { GroupService } from './group.service';
import { ToastService } from '../toast/toast.service';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-edit-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './edit-group.component.html',
  styleUrls: ['./edit-group.component.scss']
})
export class EditGroupComponent implements OnInit {
  editForm!: FormGroup;
  groupId?: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private groupService: GroupService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#000000', Validators.required],
      subject_id: ['', Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.groupId = id;
        this.loadGroupData(id);
      }
    });
  }

  async loadGroupData(id: string): Promise<void> {
    try {
      const group = await this.groupService.getGroupById(id);
      this.editForm.patchValue(group);
    } catch (error) {
      this.toastService.show('Failed to load group data', 'error');
    }
  }

  async updateGroup(): Promise<void> {
    if (this.editForm.invalid || !this.groupId) {
      this.editForm.markAllAsTouched();
      return;
    }

    try {
      await this.groupService.updateGroup(this.groupId, this.editForm.value);
      this.toastService.show('Group updated successfully', 'success');
      this.router.navigate(['/manage-groups']);
    } catch (error) {
      this.toastService.show('Failed to update group', 'error');
    }
  }
}
