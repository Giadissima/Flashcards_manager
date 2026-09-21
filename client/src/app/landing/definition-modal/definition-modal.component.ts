import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

import { ModalComponent } from '../../shared/modal/modal.component';

/** Keywords on the landing page that open this modal with a fuller definition. */
export type DefinitionTerm = 'flashcard' | 'spacedRepetition' | 'basicTest';

// Only the two terms borrowed from Wikipedia carry a "source" line; basicTest
// is our own definition of a feature specific to this project.
const TERMS_WITH_SOURCE: ReadonlySet<DefinitionTerm> = new Set(['flashcard', 'spacedRepetition']);

@Component({
  selector: 'app-definition-modal',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ModalComponent],
  templateUrl: './definition-modal.component.html',
  styleUrl: './definition-modal.component.scss',
})
export class DefinitionModalComponent {
  @Input() term: DefinitionTerm | null = null;
  @Output() closed = new EventEmitter<void>();

  get hasSource(): boolean {
    return this.term !== null && TERMS_WITH_SOURCE.has(this.term);
  }

  close(): void {
    this.closed.emit();
  }
}
