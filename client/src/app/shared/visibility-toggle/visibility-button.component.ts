import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { Visibility } from '../../models/visibility.dto';

/**
 * The quick toggle in the lists: publishing something should not mean opening
 * its edit page. It only reports what was asked for - the list keeps its own
 * data and decides what to do about it.
 */
@Component({
  selector: 'app-visibility-button',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <button type="button" class="btn btn-icon-ghost visibility-button" [disabled]="busy"
      [title]="(isPublic ? 'visibility.makePrivate' : 'visibility.makePublic') | transloco"
      [attr.aria-label]="(isPublic ? 'visibility.makePrivate' : 'visibility.makePublic') | transloco"
      (click)="toggled.emit(isPublic ? 'private' : 'public')">
      <span class="material-symbols-outlined" [class.is-public]="isPublic">{{ isPublic ? 'public' : 'lock' }}</span>
    </button>
  `,
  styles: [`
    /* Public is the state worth spotting while scanning a list: private is the
       default and stays quiet in the text colour. */
    .visibility-button .is-public {
      color: var(--accent-color);
    }
  `],
})
export class VisibilityButtonComponent {
  @Input() visibility: Visibility = 'private';
  /** Set while the change is in flight, so it cannot be asked for twice. */
  @Input() busy = false;

  @Output() toggled = new EventEmitter<Visibility>();

  get isPublic(): boolean {
    return this.visibility === 'public';
  }
}
