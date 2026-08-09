import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { charMinLength, descMaxLength, nameMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { Router } from '@angular/router';
import StarterKit from '@tiptap/starter-kit';
import { SubjectService } from '../subject.service';
import { defaultSubjectIconUrl } from '../subject-icon.util';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-create-subject',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, TiptapEditorDirective, TranslocoModule],
  templateUrl: './create-subject.component.html',
  styleUrls: ['./create-subject.component.scss']
})
export class CreateSubjectComponent implements OnInit, OnDestroy {
  subjectForm!: FormGroup;
  selectedFile: File | null = null;
  descEditor: Editor;
  descLength = 0;
  previewUrl = defaultSubjectIconUrl;

  readonly charMinLength = charMinLength;
  readonly nameMaxLength = nameMaxLength;
  readonly descMaxLength = descMaxLength;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private subjectService: SubjectService,
    private toastService: ToastService,
    private transloco: TranslocoService
  ) {
    this.descEditor = new Editor({
      extensions: [StarterKit, MathExtension.configure({ evaluation: false })],
    });
    this.descEditor.on('update', () => {
      this.descLength = this.descEditor.getText().length;
    });
  }

  ngOnInit(): void {
    this.subjectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(nameMaxLength)]]
    });
  }

  ngOnDestroy(): void {
    this.descEditor.destroy();
    if (this.selectedFile) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    if (fileList && fileList.length) {
      if (this.selectedFile) {
        URL.revokeObjectURL(this.previewUrl);
      }
      this.selectedFile = fileList[0];
      this.previewUrl = URL.createObjectURL(this.selectedFile);
    }
  }

  resetIcon(): void {
    if (this.selectedFile) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.selectedFile = null;
    this.previewUrl = defaultSubjectIconUrl;
  }

  async createSubject(): Promise<void> {
    if (this.subjectForm.invalid || this.descLength > this.descMaxLength) {
      this.subjectForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.subjectForm.get('name')?.value);
    formData.append('desc', this.descEditor.getHTML());
    if (this.selectedFile) {
      formData.append('icon', this.selectedFile, this.selectedFile.name);
    }

    try {
      await this.subjectService.createSubject(formData);
      this.toastService.show(this.transloco.translate('subject.toast.created'), 'success');
      this.router.navigate(['/manage-subjects']);
    } catch (error) {
      this.toastService.show(this.transloco.translate('subject.toast.createError'), 'error');
    }
  }
}
