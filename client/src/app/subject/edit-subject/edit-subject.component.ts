import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { baseUrlAPI, charMinLength, nameMaxLength, descMaxLength } from '../../../config/config';

@Component({
  selector: 'app-edit-subject',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, TiptapEditorDirective, TranslocoModule],
  templateUrl: './edit-subject.component.html',
  styleUrls: ['./edit-subject.component.scss']
})
export class EditSubjectComponent implements OnInit, OnDestroy {
  editForm!: FormGroup;
  subjectId?: string;
  subject?: Subject;
  selectedFile: File | null = null;
  descEditor: Editor;
  descLength = 0;

  readonly charMinLength = charMinLength;
  readonly nameMaxLength = nameMaxLength;
  readonly descMaxLength = descMaxLength;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
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
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(nameMaxLength)]]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.subjectId = id;
        this.loadSubjectData(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.descEditor.destroy();
  }

  async loadSubjectData(id: string): Promise<void> {
    try {
      this.subject = await this.subjectService.getSubjectById(id);
      this.editForm.patchValue(this.subject);
      this.descEditor.commands.setContent(this.subject.desc ?? '');
      this.descLength = this.descEditor.getText().length;
    } catch (error) {
      this.toastService.show(this.transloco.translate('subject.toast.loadOneError'), 'error');
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
    if (this.editForm.invalid || !this.subjectId || this.descLength > this.descMaxLength) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.editForm.get('name')?.value);
    formData.append('desc', this.descEditor.getHTML());
    if (this.selectedFile) {
      formData.append('icon', this.selectedFile, this.selectedFile.name);
    }

    try {
      await this.subjectService.updateSubject(this.subjectId, formData);
      this.toastService.show(this.transloco.translate('subject.toast.updated'), 'success');
      this.router.navigate(['/manage-subjects']);
    } catch (error) {
      this.toastService.show(this.transloco.translate('subject.toast.updateError'), 'error');
    }
  }
}
