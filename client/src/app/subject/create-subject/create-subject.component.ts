import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubjectService } from '../subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-create-subject',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './create-subject.component.html',
  styleUrls: ['./create-subject.component.scss']
})
export class CreateSubjectComponent implements OnInit {
  subjectForm!: FormGroup;
  selectedFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private subjectService: SubjectService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.subjectForm = this.fb.group({
      name: ['', Validators.required],
      desc: ['', Validators.required]
    });
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    if (fileList) {
      this.selectedFile = fileList[0];
    }
  }

  async createSubject(): Promise<void> {
    if (this.subjectForm.invalid) {
      this.subjectForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.subjectForm.get('name')?.value);
    formData.append('desc', this.subjectForm.get('desc')?.value);
    if (this.selectedFile) {
      formData.append('icon', this.selectedFile, this.selectedFile.name);
    }

    try {
      await this.subjectService.createSubject(formData);
      this.toastService.show('Subject created successfully', 'success');
      this.router.navigate(['/manage-subjects']);
    } catch (error) {
      this.toastService.show('Failed to create subject', 'error');
    }
  }
}
