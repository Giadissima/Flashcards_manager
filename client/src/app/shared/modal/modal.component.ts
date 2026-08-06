import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

// Deve combaciare con la durata delle animazioni "-out" in modal.component.scss:
// il modale resta nel DOM (display:block) fino allo scadere di questo timer,
// altrimenti nascondere subito l'elemento interromperebbe l'animazione a metà.
const CLOSE_ANIMATION_MS = 200;

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent {
  @Input() title = '';
  @Input() showHeader = true;
  @Input() showFooter = false;
  @Input() closeOnBackdropClick = true;
  @Input() dialogClass = '';
  @Input() contentClass = '';

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  // true finché il modale è nel DOM, anche durante l'animazione di chiusura
  visible = false;
  closing = false;

  private _isOpen = false;
  private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Setter invece di un semplice campo: sia il binding [isOpen] del parent sia
  // la chiamata interna this.isOpen = false dentro close() devono passare dallo
  // stesso punto per far scattare l'animazione di apertura/chiusura in ogni caso.
  @Input()
  set isOpen(value: boolean) {
    if (value === this._isOpen) return;
    this._isOpen = value;

    if (value) {
      if (this.closeTimeoutId) {
        clearTimeout(this.closeTimeoutId);
        this.closeTimeoutId = null;
      }
      this.closing = false;
      this.visible = true;
    } else if (this.visible) {
      this.closing = true;
      this.closeTimeoutId = setTimeout(() => {
        this.visible = false;
        this.closing = false;
        this.closeTimeoutId = null;
      }, CLOSE_ANIMATION_MS);
    }
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.close();
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.closed.emit();
  }

  onBackdropClick(): void {
    if (this.closeOnBackdropClick) this.close();
  }
}
