import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

// Must match the duration of the "-out" animations in modal.component.scss: the
// modal stays in the DOM (display:block) until this timer expires, otherwise
// hiding the element right away would cut the animation in half.
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

  // true while the modal is in the DOM, closing animation included
  visible = false;
  closing = false;

  private _isOpen = false;
  private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // A setter rather than a plain field: both the parent's [isOpen] binding and
  // the internal this.isOpen = false inside close() have to go through the same
  // place, so the open/close animation fires in either case.
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
