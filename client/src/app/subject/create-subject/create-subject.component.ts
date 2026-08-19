import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { charMinLength, descMaxLength, nameMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { Router } from '@angular/router';
import StarterKit from '@tiptap/starter-kit';
import { SubjectService } from '../subject.service';
import { defaultSubjectIconColor } from '../subject-icon.util';
import { SubjectIconPreviewComponent } from '../subject-icon-preview/subject-icon-preview.component';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-create-subject',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Toast,
    TranslocoModule,
    RichTextEditorComponent,
    SubjectIconPreviewComponent,
  ],
  templateUrl: './create-subject.component.html',
  styleUrls: ['./create-subject.component.scss']
})
export class CreateSubjectComponent implements OnInit, OnDestroy {
  subjectForm!: FormGroup;
  selectedFile: File | null = null;
  descEditor: Editor;
  descLength = 0;
  filePreviewUrl: string | null = null;

  get colorControl(): FormControl<string> {
    return this.subjectForm.get('color') as FormControl<string>;
  }

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
      extensions: [
        StarterKit,
        MathExtension.configure({ evaluation: false }),
        Image.configure({ inline: false }),
      ],
    });
    this.descEditor.on('update', () => {
      this.descLength = this.descEditor.getText().length;
    });
  }

  ngOnInit(): void {
    this.subjectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(nameMaxLength)]],
      color: [defaultSubjectIconColor, Validators.required],
    });
  }

  ngOnDestroy(): void {
    this.descEditor.destroy();
    if (this.selectedFile && this.filePreviewUrl) {
      URL.revokeObjectURL(this.filePreviewUrl);
    }
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    if (fileList && fileList.length) {
      if (this.selectedFile && this.filePreviewUrl) {
        URL.revokeObjectURL(this.filePreviewUrl);
      }
      this.selectedFile = fileList[0];
      this.filePreviewUrl = URL.createObjectURL(this.selectedFile);
    }
  }

  resetIcon(): void {
    if (this.selectedFile && this.filePreviewUrl) {
      URL.revokeObjectURL(this.filePreviewUrl);
    }
    this.selectedFile = null;
    this.filePreviewUrl = null;
  }

  async createSubject(): Promise<void> {
    if (this.subjectForm.invalid || this.descLength > this.descMaxLength) {
      this.subjectForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.subjectForm.get('name')?.value);
    formData.append('desc', this.descEditor.getHTML());
    formData.append('color', this.subjectForm.get('color')?.value);
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
