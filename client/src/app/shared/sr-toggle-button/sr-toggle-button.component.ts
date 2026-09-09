import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * The quick toggle in the lists for whether a topic (or every topic of a
 * subject at once) is drawn into the daily spaced-repetition test. Same shape
 * as VisibilityButtonComponent: it only reports what was asked for, the list
 * keeps its own data and decides what to do about it.
 */
@Component({
  selector: 'app-sr-toggle-button',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <span class="sr-toggle-slot" [title]="label | transloco">
      <button type="button" class="btn btn-icon-ghost sr-toggle-button"
        [disabled]="busy" [attr.aria-label]="label | transloco"
        (click)="toggled.emit(!enabled)">
        <span class="material-symbols-outlined" [class.is-marked]="enabled">cached</span>
      </button>
    </span>
  `,
  styles: [`
    .sr-toggle-button .is-marked {
      color: var(--accent-color);
    }

    .sr-toggle-slot {
      display: inline-flex;
    }

    .sr-toggle-button:disabled {
      pointer-events: none;
    }
  `],
})
export class SrToggleButtonComponent {
  /** Whether spaced repetition is currently on. */
  @Input() enabled = false;

  /** Set while the change is in flight, so it cannot be asked for twice. */
  @Input() busy = false;

  @Output() toggled = new EventEmitter<boolean>();

  get label(): string {
    return this.enabled ? 'spacedRepetition.turnOff' : 'spacedRepetition.turnOn';
  }
}
