import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ClickOutsideDirective } from '../click-outside.directive';

export interface SelectOption {
  value: string;
  label: string;
  iconUrl?: string;
  // alternativa a iconUrl per opzioni senza immagine ma con un colore
  // associato (es. i topic), mostrato come pallino invece dell'icona
  color?: string;
}

/**
 * Dropdown custom riusabile al posto di un <select> nativo: click per aprire/chiudere,
 * click fuori per chiudere, e ricerca digitando (type-ahead) che sposta il focus
 * sull'opzione corrispondente senza selezionarla, per poter affinare il testo.
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
})
export class SearchableSelectComponent {
  @Input() options: SelectOption[] = [];
  @Input() value: string | null | undefined = null;
  @Input() placeholder = 'Select...';
  @Input() disabled = false;
  // Se valorizzata, aggiunge una prima opzione (es. "All Subjects") che azzera la selezione
  @Input() allOptionLabel: string | null = null;
  // Tempo di inattività dopo cui il testo digitato per la ricerca viene azzerato
  @Input() typeaheadDelayMs = 1000;

  @Output() valueChange = new EventEmitter<string | null | undefined>();
  // Emesso quando il pulsante perde il focus: serve al form ospitante per marcare
  // il controllo come touched, dato che questo componente non è un ControlValueAccessor
  @Output() blurred = new EventEmitter<void>();

  @ViewChild('dropdownContent') dropdownContent?: ElementRef<HTMLElement>;

  isOpen = false;
  private typeaheadBuffer = '';
  private typeaheadTimeout?: ReturnType<typeof setTimeout>;

  get selectedOption(): SelectOption | undefined {
    return this.options.find((o) => o.value === this.value);
  }

  get selectedLabel(): string {
    return this.selectedOption?.label ?? this.placeholder;
  }

  toggle(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }

  select(value: string | null): void {
    this.value = value;
    this.isOpen = false;
    this.valueChange.emit(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    // Accumula solo caratteri singoli stampabili (ignora frecce, invio, tab, scorciatoie...)
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    event.preventDefault();

    clearTimeout(this.typeaheadTimeout);
    this.typeaheadBuffer += event.key.toLowerCase();
    this.typeaheadTimeout = setTimeout(() => (this.typeaheadBuffer = ''), this.typeaheadDelayMs);

    this.focusMatchingOption();
  }

  // Sposta il focus sulla prima opzione il cui nome inizia con il testo digitato,
  // senza selezionarla: permette di continuare a digitare per affinare la ricerca.
  private focusMatchingOption(): void {
    if (!this.dropdownContent || !this.typeaheadBuffer) return;

    const matchIndex = this.options.findIndex((o) =>
      o.label.toLowerCase().startsWith(this.typeaheadBuffer),
    );
    if (matchIndex === -1) return;

    const offset = this.allOptionLabel ? 1 : 0;
    const anchors = this.dropdownContent.nativeElement.querySelectorAll('a');
    (anchors[matchIndex + offset] as HTMLElement | undefined)?.focus();
  }
}
