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

  constructor(private toastService: ToastService) {
    this.toastService.toastMessage$.subscribe(toast => {
      this.message = toast?.message ?? null;
      this.type = toast?.type ?? 'success';
    });
  }

  close() {
    this.toastService.hide();
  }
}
