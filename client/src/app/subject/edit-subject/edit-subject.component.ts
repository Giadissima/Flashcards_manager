import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { createRichTextEditor } from '../../shared/rich-text-editor/editor.factory';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { charMinLength, nameMaxLength, descMaxLength } from '../../../config/config';
import { buildDefaultSubjectIconSvgMarkup, defaultSubjectIconColor, getSubjectIconUrl } from '../subject-icon.util';
import { SubjectIconPreviewComponent } from '../subject-icon-preview/subject-icon-preview.component';

@Component({
  selector: 'app-edit-subject',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Toast,
    TiptapEditorDirective,
    TranslocoModule,
    SubjectIconPreviewComponent,
    LoadStateComponent,
  ],
  templateUrl: './edit-subject.component.html',
})
export class EditSubjectComponent implements OnInit, OnDestroy {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  editForm!: FormGroup;
  subjectId?: string;
  subject?: Subject;
  selectedFile: File | null = null;
  descEditor: Editor;
  descLength = 0;
  // null => nessuna icona caricata (né esistente né appena scelta): si mostra
  // la preview live generata dal colore, che segue i cambi del color picker;
  // altrimenti è la url di un'icona reale (persistita sul server o del file
  // appena selezionato dall'utente)
  previewUrl: string | null = null;
  // true dopo un click su "reset": l'icona persistita va sostituita al salvataggio
  // con l'SVG di default, generato al volo con il colore scelto in quel momento
  private resetToDefault = false;

  get colorControl(): FormControl<string> {
    return this.editForm.get('color') as FormControl<string>;
  }

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
    // No Image here, as before: the toolbar of this page has no image button.
    this.descEditor = createRichTextEditor({ withImage: false });
    this.descEditor.on('update', () => {
      this.descLength = this.descEditor.getText().length;
    });
  }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(nameMaxLength)]],
      color: [defaultSubjectIconColor, Validators.required],
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.subjectId = id;
        this.loadState.run(() => this.loadSubjectData(id));
      } else {
        this.router.navigate(['/not-found']);
      }
    });
  }

  ngOnDestroy(): void {
    this.descEditor.destroy();
    this.revokePreviewUrl();
  }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async loadSubjectData(id: string): Promise<void> {
    this.subject = await this.subjectService.getSubjectById(id);
    this.editForm.patchValue({ ...this.subject, color: this.subject.color ?? defaultSubjectIconColor });
    this.descEditor.commands.setContent(this.subject.desc ?? '');
    this.descLength = this.descEditor.getText().length;
    this.previewUrl = this.subject.icon ? getSubjectIconUrl(this.subject) : null;
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList = element.files;
    if (fileList && fileList.length) {
      this.resetToDefault = false;
      this.setSelectedFile(fileList[0]);
    }
  }

  // Torna alla preview live (che segue il color picker): l'eventuale file
  // scelto va scartato, e l'icona persistita (se presente) verrà sostituita
  // al salvataggio con l'SVG di default generato al volo, vedi updateSubject().
  resetIcon(): void {
    this.resetToDefault = true;
    this.revokePreviewUrl();
    this.selectedFile = null;
    this.previewUrl = null;
  }

  private setSelectedFile(file: File): void {
    this.revokePreviewUrl();
    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  private revokePreviewUrl(): void {
    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  async updateSubject(): Promise<void> {
    if (this.editForm.invalid || !this.subjectId || this.descLength > this.descMaxLength) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.editForm.get('name')?.value);
    formData.append('desc', this.descEditor.getHTML());
    const color = this.editForm.get('color')?.value;
    formData.append('color', color);

    let fileToUpload = this.selectedFile;
    if (!fileToUpload && this.resetToDefault && this.subject?.icon) {
      const svgMarkup = buildDefaultSubjectIconSvgMarkup(color ?? defaultSubjectIconColor);
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
      fileToUpload = new File([blob], 'default-subject-icon.svg', { type: 'image/svg+xml' });
    }
    if (fileToUpload) {
      formData.append('icon', fileToUpload, fileToUpload.name);
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
