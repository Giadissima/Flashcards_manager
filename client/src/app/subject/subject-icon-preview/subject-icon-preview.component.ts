import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { AsyncPipe } from '@angular/common';
import { NgxColorsComponent, NgxColorsTriggerDirective } from 'ngx-colors';
import { SubjectIconSvgComponent } from '../subject-icon-svg/subject-icon-svg.component';
import { ThemeService } from '../../shared/theme/theme.service';

@Component({
  selector: 'app-subject-icon-preview',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    NgxColorsComponent,
    NgxColorsTriggerDirective,
    SubjectIconSvgComponent,
  ],
  templateUrl: './subject-icon-preview.component.html',
  styleUrl: './subject-icon-preview.component.scss',
})
export class SubjectIconPreviewComponent {
  @Input() previewUrl: string | null = null;
  @Input({ required: true }) colorControl!: FormControl<string>;
  @Input() colorTitle = '';
  @Input({ required: true }) previewLabel!: string;
  @Input({ required: true }) fileLabel!: string;
  @Output() reset = new EventEmitter<void>();
  @Output() fileSelected = new EventEmitter<Event>();

  constructor(protected themeService: ThemeService) {}

  onReset(fileInput: HTMLInputElement): void {
    fileInput.value = '';
    this.reset.emit();
  }
}
