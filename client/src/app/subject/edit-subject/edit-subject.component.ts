import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { baseUrlAPI } from '../../../config/config';

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
  subject?: Subject;
  selectedFile: File | null = null;

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
      this.subject = await this.subjectService.getSubjectById(id);
      this.editForm.patchValue(this.subject);
    } catch (error) {
      this.toastService.show('Failed to load subject data', 'error');
    }
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList = element.files;
    if (fileList && fileList.length) {
      this.selectedFile = fileList[0];
    }
  }

  // subject.icon è l'id del file salvato su Mongo, non una URL: va risolto
  // sull'endpoint che serve i byte del file (stessa logica di manage-subjects)
  getIconUrl(): string {
    return this.subject?.icon ? `${baseUrlAPI}file/${this.subject.icon}` : 'assets/logo3.png';
  }

  async updateSubject(): Promise<void> {
    if (this.editForm.invalid || !this.subjectId) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.editForm.get('name')?.value);
    formData.append('desc', this.editForm.get('desc')?.value);
    if (this.selectedFile) {
      formData.append('icon', this.selectedFile, this.selectedFile.name);
    }

    try {
      await this.subjectService.updateSubject(this.subjectId, formData);
      this.toastService.show('Subject updated successfully', 'success');
      this.router.navigate(['/manage-subjects']);
    } catch (error) {
      this.toastService.show('Failed to update subject', 'error');
    }
  }
}
