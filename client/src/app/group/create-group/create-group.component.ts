import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { GroupService } from '../group.service';
import { Router } from '@angular/router';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './create-group.component.html',
  styleUrls: ['./create-group.component.scss']
})
export class CreateGroupComponent implements OnInit {
  groupForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private groupService: GroupService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#000000', Validators.required], // Default to black
      subject_id: ['', Validators.required] // Assuming subject_id is required
    });
  }

  async createGroup(): Promise<void> {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }

    try {
      await this.groupService.createGroup(this.groupForm.value);
      this.toastService.show('Group created successfully', 'success');
      this.router.navigate(['/manage-groups']);
    } catch (error) {
      this.toastService.show('Failed to create group', 'error');
    }
  }
}
