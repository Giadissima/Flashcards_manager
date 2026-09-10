import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';
import { SearchableSelectComponent } from '../searchable-select/searchable-select.component';

/** Turns a YYYY-MM-DD day into a local Date, so no UTC offset shifts it by a day. */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The reverse of toDate: a local Date back to the YYYY-MM-DD the app deals in. */
function toIsoDate(value: Date | null): string | null {
  if (!value) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The two ends of the range, as plain YYYY-MM-DD days; null is an open end. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

/** One of the dates a list can be narrowed by, as offered in the dropdown. */
export interface DateFieldOption {
  value: string;
  label: string;
}

/**
 * The date range every list is narrowed by: flashcards, tests and the feed.
 *
 * from/to are the API the parent talks to; range is only the internal
 * FormGroup the Material range picker needs to hold its two dates. The two
 * stay in sync through ngOnChanges (parent -> range) and the valueChanges
 * subscription (range -> parent), both going through emit() so from/to are
 * always the source of truth.
 *
 * Typing (or pasting) a date by hand can still put the range the wrong way
 * round even though the picker itself cannot, which is what the sort in
 * emit() is for.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
  ],
  templateUrl: './date-range-filter.component.html',
  styleUrl: './date-range-filter.component.scss',
})
export class DateRangeFilterComponent implements OnChanges {
  @Input() from: string | null = null;
  @Input() to: string | null = null;
  @Input() disabled = false;

  /**
   * The dates this list can be narrowed by, when it has more than one.
   *
   * Left empty by the lists that have a single date worth filtering on, which
   * then show the range on its own. Where there are two, naming them is not a
   * convenience but the point: two identical date boxes say nothing about
   * which of the two dates they read, and the answer changes the results.
   */
  @Input() fields: DateFieldOption[] = [];
  @Input() field: string | null = null;

  @Output() rangeChange = new EventEmitter<DateRange>();
  @Output() fieldChange = new EventEmitter<string>();

  /** Bound as the picker's max: no list is ever narrowed by a future day. */
  readonly today = new Date();

  /** Backs the Material range picker; from/to stay the source of truth for the parent. */
  readonly range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  constructor() {
    // syncRange stays false here: this change came from range itself, so
    // writing back into it in the same tick is what froze the picker on
    // click - Material was still mid-update on that same FormGroup.
    this.range.valueChanges.subscribe(({ start, end }) =>
      this.emit(toIsoDate(start ?? null), toIsoDate(end ?? null), false),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['from'] || changes['to']) {
      this.range.setValue(
        { start: toDate(this.from), end: toDate(this.to) },
        { emitEvent: false },
      );
    }
    if (changes['disabled']) {
      if (this.disabled) this.range.disable({ emitEvent: false });
      else this.range.enable({ emitEvent: false });
    }
  }

  // The shared select's valueChange can carry null/undefined (its
  // all-options case), which this field never offers - there is always one
  // of the two dates selected, so only a real value is ever passed through.
  onField(value: string | null | undefined): void {
    if (!value) return;
    this.field = value;
    this.fieldChange.emit(value);
  }

  clear(): void {
    this.emit(null, null);
  }

  /**
   * syncRange writes the (possibly reordered) dates back into the picker's
   * FormGroup. Skip it when the call originates from range's own
   * valueChanges - Material is still mid-update on that same FormGroup at
   * that point, and a setValue back into it there froze the picker.
   */
  private emit(from: string | null, to: string | null, syncRange = true): void {
    // Put in order rather than refused: a range typed the wrong way round
    // would match nothing at all, and the two days somebody named are the two
    // ends they meant. ISO dates sort as text, which is what makes this a
    // comparison and not a parse.
    if (from && to && from > to) [from, to] = [to, from];

    this.from = from;
    this.to = to;
    if (syncRange) {
      this.range.setValue({ start: toDate(from), end: toDate(to) }, { emitEvent: false });
    }
    this.rangeChange.emit({ from, to });
  }
}
