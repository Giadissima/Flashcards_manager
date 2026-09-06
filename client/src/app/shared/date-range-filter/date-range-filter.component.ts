import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

/** The two ends of the range, as plain YYYY-MM-DD days; null is an open end. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

/**
 * The date range every list is narrowed by: flashcards, tests and the feed.
 *
 * Two native date inputs rather than a datepicker library. The browser already
 * has a calendar, in the reader's own language and with the keyboard and
 * screen-reader behaviour of a real form control, and it costs nothing to
 * ship - a picker component would be some hundred kilobytes to draw the same
 * grid, plus a second look to keep in step with the theme.
 *
 * The two ends limit each other through min and max, so the calendar cannot
 * offer a range the wrong way round; typing one by hand still can, which is
 * what the sort in emit() is for.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './date-range-filter.component.html',
  styleUrl: './date-range-filter.component.scss',
})
export class DateRangeFilterComponent {
  @Input() from: string | null = null;
  @Input() to: string | null = null;
  @Input() disabled = false;

  @Output() rangeChange = new EventEmitter<DateRange>();

  onFrom(value: string): void {
    this.emit(value || null, this.to);
  }

  onTo(value: string): void {
    this.emit(this.from, value || null);
  }

  clear(): void {
    this.emit(null, null);
  }

  private emit(from: string | null, to: string | null): void {
    // Put in order rather than refused: a range typed the wrong way round
    // would match nothing at all, and the two days somebody named are the two
    // ends they meant. ISO dates sort as text, which is what makes this a
    // comparison and not a parse.
    if (from && to && from > to) [from, to] = [to, from];

    this.from = from;
    this.to = to;
    this.rangeChange.emit({ from, to });
  }
}
