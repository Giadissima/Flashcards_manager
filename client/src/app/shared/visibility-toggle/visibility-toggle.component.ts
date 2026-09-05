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

  /**
   * What is being published. A subject carries its topics and cards with it,
   * and a topic its cards - both ways round - so the form has to say so before
   * the switch is touched, not after.
   */
  @Input() kind: 'subject' | 'topic' | 'flashcard' = 'flashcard';

  readonly inputId = `visibility-switch-${nextId++}`;

  /** The key of the line explaining what the choice drags along, if anything. */
  get cascadeKey(): string | null {
    if (this.kind === 'subject') return 'visibility.cascadeSubject';
    if (this.kind === 'topic') return 'visibility.cascadeTopic';
    return null;
  }

  get isPublic(): boolean {
    return this.control.value === 'public';
  }

  toggle(): void {
    this.control.setValue(this.isPublic ? 'private' : 'public');
    this.control.markAsDirty();
  }
}
