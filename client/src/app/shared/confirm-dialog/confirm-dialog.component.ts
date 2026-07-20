import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';

/**
 * Dialog di conferma generico in stile Bootstrap, stessa struttura/markup
 * di ImportExportModalComponent per restare coerenti con il resto dell'app.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal fade" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ title }}</h5>
            <button type="button" class="btn-close" (click)="onCancel()"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">{{ message }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" (click)="onCancel()">{{ cancelLabel }}</button>
            <button type="button" class="btn btn-primary" (click)="onConfirm()">{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'" (click)="onCancel()"></div>
  `,
  styles: [`
    .modal {
      background: rgba(0,0,0,0.5);
      z-index: 1055;
    }
    .modal-backdrop {
      z-index: 1050;
    }
    .modal.show {
      display: block;
    }
    .modal-content {
      border-radius: 12px;
      border: none;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() isOpen = false;
  @Input() title = 'Conferma';
  @Input() message = '';
  @Input() confirmLabel = 'Sì';
  @Input() cancelLabel = 'Annulla';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
