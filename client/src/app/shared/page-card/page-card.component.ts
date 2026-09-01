import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface PageCardAction {
  /** Already translated, like the title and the subtitle. */
  label: string;

  /** Material Symbols name shown before the label. */
  icon?: string;

  /** Set it to render the action as a link; leave it out to get a button
      reporting through (action). */
  link?: string | unknown[];

  /** 'primary' is the action the page exists for; 'outline' is anything beside it. */
  variant?: 'primary' | 'outline';

  disabled?: boolean;
}

/**
 * The card every page is built on: a header with a round Material Symbols icon,
 * a title, an optional subtitle and the actions of the page on the right, a
 * rule, and the page content projected into the body.
 *
 * Texts are passed already translated, so the caller keeps control over its own
 * translation keys and parameters.
 *
 * The actions are an array because a page can have more than one, and they all
 * have to line up, space and centre the same way - which is what a page drawing
 * its own buttons in the slot cannot be held to. A page with a single action
 * passes an array of one and listens to (action) without reading the payload.
 *
 * Usage:
 *   <app-page-card icon="cards_stack" [title]="..." [subtitle]="..."
 *     [actions]="[{ label: t('...'), icon: 'add' }]" (action)="create()">
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

  /** Drawn in order, from the one the page exists for to the ones beside it. */
  @Input() actions: PageCardAction[] = [];

  /** The action pressed: a page with one of them can ignore what it is given. */
  @Output() action = new EventEmitter<PageCardAction>();

  buttonClass(action: PageCardAction): string {
    return action.variant === 'outline' ? 'btn-outline-primary' : 'btn-primary';
  }
}
