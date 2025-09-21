import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { SubjectService } from './subject.service';
import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-edit-subject',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './edit-subject.component.html',
  styleUrls: ['./edit-subject.component.scss']
})
export class EditSubjectComponent implements OnInit {
  editForm!: FormGroup;
  subjectId?: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private subjectService: SubjectService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      desc: ['', Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.subjectId = id;
        this.loadSubjectData(id);
      }
    });
  }

  async loadSubjectData(id: string): Promise<void> {
    try {
      const subject = await this.subjectService.getSubjectById(id);
      this.editForm.patchValue(subject);
    } catch (error) {
      this.toastService.show('Failed to load subject data', 'error');
    }
  }

  async updateSubject(): Promise<void> {
    if (this.editForm.invalid || !this.subjectId) {
      this.editForm.markAllAsTouched();
      return;
    }
    console.log("AAAA", this.subjectId);
    try {
      await this.subjectService.updateSubject(this.subjectId, this.editForm.value);
      this.toastService.show('Subject updated successfully', 'success');
      this.router.navigate(['/manage-subjects']);
    } catch (error) {
      this.toastService.show('Failed to update subject', 'error');
    }
  }
}
