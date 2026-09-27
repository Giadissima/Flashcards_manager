import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * A password <input> with a show/hide toggle, dropped in wherever a password
 * is typed across the site (login, register, profile, reset). Works with
 * reactive forms (formControlName) and template-driven ones ([(ngModel)])
 * alike, since both only ever talk to a ControlValueAccessor.
 *
 * Usage:
 *   <app-password-field formControlName="password" id="password"
 *     autocomplete="current-password"></app-password-field>
 */
@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  template: `
    <div class="input-group password-field">
      <input [id]="id" [type]="visible ? 'text' : 'password'" class="form-control" [autocomplete]="autocomplete"
        [placeholder]="placeholder" [attr.autofocus]="autofocus ? '' : null" [disabled]="disabled" [ngModel]="value"
        (ngModelChange)="onInput($event)" (blur)="onTouched()">
      <button type="button" class="btn btn-icon-ghost"
        [attr.aria-label]="(visible ? 'auth.hidePassword' : 'auth.showPassword') | transloco" [disabled]="disabled"
        (click)="visible = !visible">
        <span class="material-symbols-outlined">{{ visible ? 'visibility_off' : 'visibility' }}</span>
      </button>
    </div>
  `,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => PasswordFieldComponent),
    multi: true,
  }],
})
export class PasswordFieldComponent implements ControlValueAccessor {
  @Input() id = '';
  @Input() autocomplete: 'current-password' | 'new-password' = 'current-password';
  @Input() autofocus = false;
  @Input() placeholder = '';

  visible = false;
  value = '';
  disabled = false;

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  onInput(value: string): void {
    this.value = value;
    this.onChange(value);
  }
}
