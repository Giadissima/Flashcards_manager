import { Component, Input, Output, EventEmitter } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Search bar riutilizzabile: campo di testo + icona di ricerca (a destra) +
 * pulsante "X" per svuotare rapidamente il campo, visibile solo quando c'è testo.
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss',
})
export class SearchInputComponent {
  @Input() value: string = '';
  @Input() placeholder = '';
  @Input() inputId = 'searchFilter';

  @Output() valueChange = new EventEmitter<string>();

  onInput(value: string): void {
    this.value = value;
    this.valueChange.emit(value);
  }

  clear(): void {
    this.onInput('');
  }
}
