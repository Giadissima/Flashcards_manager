import { ToastService, ToastType } from './toast.service';

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './toast.html',
  styleUrl: './toast.scss'
})
export class Toast {
  message: string | null = null;
  type: ToastType = 'success';
  actionLabel: string | null = null;
  private onAction: (() => void) | null = null;
  private onDismiss: (() => void) | null = null;

  constructor(private toastService: ToastService) {
    this.toastService.toastMessage$.subscribe(toast => {
      this.message = toast?.message ?? null;
      this.type = toast?.type ?? 'success';
      this.actionLabel = toast?.actionLabel ?? null;
      this.onAction = toast?.onAction ?? null;
      this.onDismiss = toast?.onDismiss ?? null;
    });
  }

  close() {
    // Closing the toast is not ignoring it: whoever raised it is told, so an
    // offer that was only good while it was on screen ends here rather than
    // waiting out a countdown the reader has just dismissed.
    this.onDismiss?.();
    this.toastService.hide();
  }

  triggerAction() {
    this.onAction?.();
    this.toastService.hide();
  }
}
