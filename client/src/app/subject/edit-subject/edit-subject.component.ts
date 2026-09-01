import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { createRichTextEditor } from '../../shared/rich-text-editor/editor.factory';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';
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
    RichTextEditorComponent,
    TranslocoModule,
    SubjectIconPreviewComponent,
    LoadStateComponent,
    PageCardComponent,
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
  // the live preview generated from the colour, which follows the colour picker;
  // otherwise it is the URL of a real icon, either stored on the server or the
  // file just selected by the user
  previewUrl: string | null = null;
  // true after a "reset" click: on save the stored icon has to be replaced with
  // the default SVG, generated on the fly with the colour chosen at that moment
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
    // Same editor as the create page, images included: TipTap parses the stored
    // HTML against the registered schema, so without Image the <img> tags of an
    // existing description would be silently dropped on load.
    this.descEditor = createRichTextEditor({ withImage: true });
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

  // Goes back to the live preview, which follows the colour picker: any picked
  // scelto va scartato, e l'icona persistita (se presente) verrà sostituita
  // on save with the default SVG generated on the fly, see updateSubject().
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
