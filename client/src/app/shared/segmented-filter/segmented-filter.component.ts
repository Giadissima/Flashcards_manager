import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface SegmentedOption {
  value: string;
  /** Already translated, like everywhere else a caller passes text in. */
  label: string;
  /** Optional, shown next to the label: how much is behind that choice. */
  count?: number;
}

/**
 * A filter with few, always visible choices, laid out as one strip of buttons.
 * A select hides its options behind a click and is the right control for a
 * list of subjects; for three fixed choices the strip states them all, and the
 * one in force is read without opening anything.
 *
 * Usage:
 *   <app-segmented-filter [options]="outcomeOptions" [value]="outcome"
 *     (valueChange)="onOutcomeChange($event)"></app-segmented-filter>
 */
@Component({
  selector: 'app-segmented-filter',
  standalone: true,
  templateUrl: './segmented-filter.component.html',
  styleUrl: './segmented-filter.component.scss'
})
export class SegmentedFilterComponent {
  @Input({ required: true }) options: SegmentedOption[] = [];
  @Input({ required: true }) value: string | null = null;

  /** Names the group for a screen reader, which sees a row of buttons. */
  @Input() label = '';

  @Output() valueChange = new EventEmitter<string>();

  select(option: SegmentedOption): void {
    if (option.value !== this.value) this.valueChange.emit(option.value);
  }
}
