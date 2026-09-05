import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { AsyncPipe } from '@angular/common';
import { ImageCropEditorComponent } from '../image-crop-editor/image-crop-editor.component';
import { NgxColorsComponent, NgxColorsTriggerDirective } from 'ngx-colors';
import { ThemeService } from '../theme/theme.service';

/**
 * A round picture that can be replaced by an upload or, while none is set,
 * recoloured: the preview, the colour swatch, the file picker and the crop
 * editor behind it.
 *
 * The drawing shown when nothing is uploaded is projected in by the caller
 * (slot "defaultIcon"), because it is the only part that differs: a subject
 * gets its book, a user gets the person figure. Everything else - cropping
 * before handing the file over, clearing, the colour picker - is the same
 * behaviour in both places and is defined once, here.
 */
@Component({
  selector: 'app-icon-preview',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    NgxColorsComponent,
    NgxColorsTriggerDirective,
    ImageCropEditorComponent,
  ],
  templateUrl: './icon-preview.component.html',
  styleUrl: './icon-preview.component.scss',
})
export class IconPreviewComponent {
  @Input() previewUrl: string | null = null;
  @Input({ required: true }) colorControl!: FormControl<string>;
  @Input() colorTitle = '';
  @Input({ required: true }) previewLabel!: string;
  @Input({ required: true }) fileLabel!: string;
  @Output() reset = new EventEmitter<void>();
  /** The icon to upload: what came out of the crop editor, never the raw file. */
  @Output() fileSelected = new EventEmitter<File>();

  @ViewChild(ImageCropEditorComponent) private cropEditor?: ImageCropEditorComponent;

  constructor(protected themeService: ThemeService) {}

  // The picked file is not handed over as it is: the image is shown in a circle,
  // so it goes through the crop editor first and only the result gets out.
  onFileChosen(event: Event, fileInput: HTMLInputElement): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    // Cleared right away, not when the editor closes: without it, picking the
    // same file again after a cancel fires no change event at all.
    fileInput.value = '';
    if (file) this.cropEditor?.open(file);
  }

  onCropped(file: File): void {
    this.fileSelected.emit(file);
  }

  onReset(fileInput: HTMLInputElement): void {
    fileInput.value = '';
    this.reset.emit();
  }
}
