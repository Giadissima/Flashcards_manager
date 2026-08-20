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
  private _toastMessage = new BehaviorSubject<ToastData | null>(null); // crea un BehaviorSubject, ovvero uno stream di eventi osservabile capace di memorizzare il valore attuale e il valore precedente, lo inizializziamo a null
  toastMessage$ = this._toastMessage.asObservable(); // creo un observable che osserva i cambiamenti del BehaviorSubect
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  show(message: string, type: ToastType, options?: ToastOptions) { // mostro il messaggio e poi chiudo dopo la durata indicata
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
