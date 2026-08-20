import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ClickOutsideDirective } from '../click-outside.directive';

export interface SelectOption {
  value: string;
  label: string;
  iconUrl?: string;
  // Alternative to iconUrl for options with no image but an associated color
  // (topics, for instance): rendered as a dot instead of the icon.
  color?: string;
}

/**
 * Reusable custom dropdown replacing a native <select>: click to open/close,
 * click outside to close, and type-ahead search that moves the focus onto the
 * matching option without selecting it, so the text can still be refined.
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
  // When set, adds a first option (e.g. "All Subjects") that clears the selection
  @Input() allOptionLabel: string | null = null;
  // Idle time after which the typed search text is discarded
  @Input() typeaheadDelayMs = 1000;

  @Output() valueChange = new EventEmitter<string | null | undefined>();
  // Emitted when the button loses focus: the hosting form needs it to mark the
  // control as touched, since this component is not a ControlValueAccessor
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
    // Only accumulate single printable characters (skip arrows, enter, tab, shortcuts...)
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    event.preventDefault();

    clearTimeout(this.typeaheadTimeout);
    this.typeaheadBuffer += event.key.toLowerCase();
    this.typeaheadTimeout = setTimeout(() => (this.typeaheadBuffer = ''), this.typeaheadDelayMs);

    this.focusMatchingOption();
  }

  // Moves the focus to the first option whose label starts with the typed text,
  // without selecting it, so the user can keep typing to refine the search.
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
