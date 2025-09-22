import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { GroupService } from './../group.service';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

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
  subjects: Subject[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private groupService: GroupService,
    private toastService: ToastService,
    private subjectService: SubjectService
  ) {}

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#75d2cb', Validators.required],
      subject_id: ['']
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.groupId = id;
        this.loadGroupData(id);
      }
    });

    this.loadSubjects();
  }

  async loadGroupData(id: string): Promise<void> {
    try {
      const group = await this.groupService.getGroupById(id);
      console.dir(group);
      this.editForm.patchValue({
      name: group.name,
      color: group.color,
      subject_id: typeof group.subject_id === 'string' ? '' : group.subject_id._id
    });
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
