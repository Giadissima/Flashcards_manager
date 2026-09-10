import { Component, Input, OnChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Where a card came from, read on hover: a plain label, not a control - unlike
 * the visibility toggle it sits beside, there is nothing to click here.
 *
 * The username is resolved live by the server (see Flashcard.imported_from),
 * so this only has to pick which of the two tooltips to show.
 */
@Component({
  selector: 'app-imported-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (imported) {
    <span class="material-symbols-outlined imported-badge" [title]="tooltip">move_to_inbox</span>
    }
  `,
  styles: [`
    .imported-badge {
      color: var(--accent-color);
    }
  `],
})
export class ImportedBadgeComponent implements OnChanges {
  @Input() imported = false;
  /** The source card's owner, when the server could resolve it. */
  @Input() username?: string | null;

  tooltip = '';

  constructor(private transloco: TranslocoService) {}

  ngOnChanges(): void {
    this.tooltip = this.username
      ? this.transloco.translate('visibility.importedFrom', { username: this.username })
      : this.transloco.translate('visibility.importedFromUnknown');
  }
}
