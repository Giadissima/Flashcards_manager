import { Component, EventEmitter, Input, Output } from '@angular/core';

import { TranslocoModule } from '@jsverse/transloco';

/**
 * The control under a paginated list: a button to either side of the position
 * in the list. The state it shows lives in PaginatedList, which the pages
 * extend; this only draws it and reports what was pressed.
 *
 * The buttons carry an arrow and a word, and drop to the arrow alone on a
 * phone, where the words are what the control can least afford of its width.
 *
 * Usage:
 *   <app-pagination [currentPage]="currentPage" [totalPages]="totalPages"
 *     (previous)="previousPage()" (next)="nextPage()"></app-pagination>
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss'
})
export class PaginationComponent {
  @Input({ required: true }) currentPage = 1;
  @Input({ required: true }) totalPages = 1;

  /** Holds both buttons while the list behind them is being reloaded. */
  @Input() disabled = false;

  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
}
