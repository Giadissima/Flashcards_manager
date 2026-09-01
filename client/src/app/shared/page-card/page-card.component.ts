import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * The card every page is built on: a header with a round Material Symbols icon,
 * a title, an optional subtitle and an optional action on the right, a rule,
 * and the page content projected into the body.
 *
 * Texts are passed already translated, so the caller keeps control over its own
 * translation keys and parameters.
 *
 * Nearly every page puts a single "new something" action up there, so it is an
 * input: pass actionLabel plus either actionLink (renders an anchor) or listen
 * to (action) (renders a button). The card-actions slot is still there for the
 * pages that need something the input cannot express.
 *
 * Usage:
 *   <app-page-card icon="cards_stack" [title]="..." [subtitle]="..."
 *     [actionLabel]="..." (action)="create()">
 *     ...body...
 *   </app-page-card>
 */
@Component({
  selector: 'app-page-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './page-card.component.html',
  styleUrl: './page-card.component.scss'
})
export class PageCardComponent {
  @Input({ required: true }) icon = '';
  @Input({ required: true }) title = '';
  @Input() subtitle = '';

  /** Extra classes for the body, e.g. "p-4" for the pages that want a roomier padding. */
  @Input() bodyClass = '';

  /** Already translated, like title and subtitle. Nothing is rendered without it. */
  @Input() actionLabel = '';

  /** Material Symbols name shown before the label. */
  @Input() actionIcon = 'add';

  /** Set it to render the action as a link; leave it out to get a button. */
  @Input() actionLink?: string | unknown[];

  @Output() action = new EventEmitter<void>();
}
