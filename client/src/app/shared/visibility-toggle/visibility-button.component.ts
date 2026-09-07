import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { TranslocoModule } from '@jsverse/transloco';
import { Visibility } from '../../models/visibility.dto';

/**
 * The quick toggle in the lists: publishing something should not mean opening
 * its edit page. It only reports what was asked for - the list keeps its own
 * data and decides what to do about it.
 *
 * On an imported card it stops being a control and becomes a label: the state
 * is fixed, and the icon is there to say why nothing can be done about it.
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
      <button type="button" class="btn btn-icon-ghost visibility-button" [class.is-imported]="imported"
        [disabled]="busy || imported || !canPublish" [attr.aria-label]="label | transloco"
        (click)="toggled.emit(isPublic ? 'private' : 'public')">
        <span class="material-symbols-outlined" [class.is-marked]="isPublic || imported">{{ icon }}</span>
      </button>
    </span>
  `,
  styles: [`
    /* Public, and imported, are the states worth spotting while scanning a
       list: private is the default and stays quiet in the text colour. */
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

    /* An imported card is not a control that happens to be off, it is a state
       read exactly like the globe beside it, so it keeps the same colour and
       no outline: the disabled defaults would grey it and draw a border round
       it, which is the one thing that would make it look clickable-but-off. */
    .visibility-button.is-imported {
      --bs-btn-disabled-color: var(--accent-color);
      --bs-btn-disabled-border-color: transparent;
      opacity: 1;
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
  /**
   * Somebody else's card, kept in one's own library: it can be studied and
   * edited, never published again, so the button is dead and says so.
   */
  @Input() imported = false;

  @Output() toggled = new EventEmitter<Visibility>();

  get isPublic(): boolean {
    return this.visibility === 'public';
  }

  /* The tray it arrived in, rather than another lock: what the corner has to
     say about an imported card is where it came from, and "somebody else's"
     is the whole reason it cannot go back out. */
  get icon(): string {
    if (this.imported) return 'move_to_inbox';
    return this.isPublic ? 'public' : 'lock';
  }

  get label(): string {
    if (this.imported) return 'visibility.imported';
    if (!this.canPublish) return 'visibility.needUniversity';
    return this.isPublic ? 'visibility.makePrivate' : 'visibility.makePublic';
  }
}
