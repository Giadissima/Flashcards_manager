import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';

/**
 * Generic confirmation dialog, built on top of ModalComponent so it stays
 * consistent with the other modals of the app.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal [isOpen]="isOpen" [title]="title" [showFooter]="true" (closed)="onCancel()">
      <p class="mb-0">{{ message }}</p>
      <ng-container modal-footer>
        <button type="button" class="btn btn-outline-secondary" (click)="onCancel()">{{ cancelLabel }}</button>
        <button type="button" class="btn btn-primary" (click)="onConfirm()">{{ confirmLabel }}</button>
      </ng-container>
    </app-modal>
  `
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
