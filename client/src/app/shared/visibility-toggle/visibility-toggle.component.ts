import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { Visibility } from '../../models/visibility.dto';

/** Ids have to differ once two switches sit on the same page. */
let nextId = 0;

/**
 * The switch that publishes a flashcard, a subject or a topic. Shared by the
 * six create and edit forms, which all ask the same question about a field that
 * behaves the same way everywhere.
 *
 * It takes the control rather than a value, as app-icon-preview does with the
 * colour: the form stays the single owner of what it is about to send.
 */
@Component({
  selector: 'app-visibility-toggle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule],
  templateUrl: './visibility-toggle.component.html',
  styleUrl: './visibility-toggle.component.scss',
})
export class VisibilityToggleComponent {
  @Input({ required: true }) control!: FormControl<Visibility>;

  readonly inputId = `visibility-switch-${nextId++}`;

  get isPublic(): boolean {
    return this.control.value === 'public';
  }

  toggle(): void {
    this.control.setValue(this.isPublic ? 'private' : 'public');
    this.control.markAsDirty();
  }
}
