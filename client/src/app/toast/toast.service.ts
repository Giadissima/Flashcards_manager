import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info'; 

export interface ToastData {
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private _toastMessage = new BehaviorSubject<ToastData | null>(null); // crea un BehaviorSubject, ovvero uno stream di eventi osservabile capace di memorizzare il valore attuale e il valore precedente, lo inizializziamo a null
  toastMessage$ = this._toastMessage.asObservable(); // creo un observable che osserva i cambiamenti del BehaviorSubect

  show(message: string, type: ToastType) { // mostro il messaggio per 3 secondi e poi chiudo
    this._toastMessage.next({message, type}); 
    setTimeout(() => this._toastMessage.next(null), 3000); // auto-hide dopo 3s
  }

  hide() {
    this._toastMessage.next(null);
  }
}
