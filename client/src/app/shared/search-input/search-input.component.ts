import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Reusable search bar: text field + search button (on the right) + an "X"
 * button to clear the field quickly, shown only while there is something to
 * clear. Typing only updates `value` (two-way bound); the actual search is
 * only emitted via `search`, fired by the search button, the Enter key, or
 * the clear button - never on every keystroke.
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss'
})
export class SearchInputComponent {
  @Input() value: string = '';
  @Input() placeholder = '';
  @Input() inputId = 'searchFilter';
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<string>();

  onInput(value: string): void {
    this.value = value;
    this.valueChange.emit(value);
  }

  onSearch(): void {
    this.search.emit(this.value);
  }

  clear(): void {
    this.onInput('');
    this.onSearch();
  }
}
