import { Component, Input } from '@angular/core';

import { TranslocoModule } from '@jsverse/transloco';

/* Wraps a filter bar and, on phones only, folds it behind a toggle: there the
   bar is a column of full-width controls that would push the content of the
   page below the fold, while most visits do not filter at all. From the sm
   breakpoint up the toggle is hidden and the bar is always open. */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  private static nextId = 0;

  /** Shown as a badge on the toggle, so a collapsed bar still says it is filtering. */
  @Input() activeCount = 0;

  /* How the bar is set apart from what surrounds it: 'raised' for a bar sitting
     on the page background, 'inset' for one inside a card, where a shadow would
     not read and a recessed panel does. */
  @Input() appearance: 'raised' | 'inset' = 'raised';

  /** Optional heading naming the bar as settings; hidden on phones, where the
      toggle already carries the label. */
  @Input() caption?: string;

  open = false;

  // Ties the toggle to the panel it controls when a page draws more than one bar.
  readonly panelId = `filter-bar-${FilterBarComponent.nextId++}`;

  toggle(): void {
    this.open = !this.open;
  }
}
