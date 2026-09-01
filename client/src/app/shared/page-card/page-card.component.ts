import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';

/**
 * The card every page is built on: a header with a round Material Symbols icon,
 * a title, an optional subtitle and an optional action on the right, a rule,
 * and the page content projected into the body.
 *
 * Texts are passed already translated, so the caller keeps control over its own
 * translation keys and parameters.
 *
 * Usage:
 *   <app-page-card icon="cards_stack" [title]="..." [subtitle]="...">
 *     <button card-actions class="btn btn-primary">...</button>
 *     ...body...
 *   </app-page-card>
 */
@Component({
  selector: 'app-page-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-card.component.html',
  styleUrl: './page-card.component.scss'
})
export class PageCardComponent {
  @Input({ required: true }) icon = '';
  @Input({ required: true }) title = '';
  @Input() subtitle = '';

  /** Extra classes for the body, e.g. "p-4" for the pages that want a roomier padding. */
  @Input() bodyClass = '';
}
