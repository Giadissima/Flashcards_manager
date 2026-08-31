import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Reusable search bar: text field + search icon (on the right) + an "X" button
 * to clear the field quickly, shown only while there is something to clear.
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

  onInput(value: string): void {
    this.value = value;
    this.valueChange.emit(value);
  }

  clear(): void {
    this.onInput('');
  }
}
