import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  // BehaviorSubject: an observable stream that also remembers its current value,
  // so a subscriber attaching later still receives the toast on screen.
  private _toastMessage = new BehaviorSubject<ToastData | null>(null);
  toastMessage$ = this._toastMessage.asObservable();
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Shows the message, then hides it again after the given duration.
  show(message: string, type: ToastType, options?: ToastOptions) {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    this._toastMessage.next({ message, type, actionLabel: options?.actionLabel, onAction: options?.onAction });
    this.hideTimeout = setTimeout(() => this._toastMessage.next(null), options?.duration ?? 3000); // auto-hide
  }

  hide() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this._toastMessage.next(null);
  }
}
