import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
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
    <!-- The title sits on the wrapper and not on the button: a disabled button
         fires no mouse events, so a tooltip written on it never shows - which
         is exactly the case that most needs to explain itself. -->
    <span class="visibility-slot" [title]="label | transloco">
      <button type="button" class="btn btn-icon-ghost visibility-button"
        [disabled]="busy || !canPublish" [attr.aria-label]="label | transloco"
        (click)="toggled.emit(isPublic ? 'private' : 'public')">
        <span class="material-symbols-outlined" [class.is-marked]="isPublic">{{ icon }}</span>
      </button>
    </span>
  `,
  styles: [`
    /* Public is the state worth spotting while scanning a list: private is
       the default and stays quiet in the text colour. */
    .visibility-button .is-marked {
      color: var(--accent-color);
    }

    .visibility-slot {
      display: inline-flex;
    }

    /* Lets the hover through to the wrapper above, which is what carries the
       tooltip. */
    .visibility-button:disabled {
      pointer-events: none;
    }
  `],
})
export class VisibilityButtonComponent {
  @Input() visibility: Visibility = 'private';

  constructor(private authService: AuthService) {}

  /**
   * Sharing waits for the profile to say where its author studies; taking
   * something back never does. See VisibilityToggleComponent for why.
   */
  get canPublish(): boolean {
    return !!this.authService.user?.universityCode || this.isPublic;
  }
  /** Set while the change is in flight, so it cannot be asked for twice. */
  @Input() busy = false;

  @Output() toggled = new EventEmitter<Visibility>();

  get isPublic(): boolean {
    return this.visibility === 'public';
  }

  get icon(): string {
    return this.isPublic ? 'public' : 'lock';
  }

  get label(): string {
    if (!this.canPublish) return 'visibility.needUniversity';
    return this.isPublic ? 'visibility.makePrivate' : 'visibility.makePublic';
  }
}
