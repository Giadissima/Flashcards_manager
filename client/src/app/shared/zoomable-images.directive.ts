import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Put on a container that renders stored HTML through [innerHTML]: a click on
 * any <img> inside it emits that image's src.
 *
 * The images come from the database, so there is no element to bind a handler
 * to individually - the click has to be caught on the container and filtered.
 */
@Directive({
  selector: '[zoomableImages]',
  standalone: true,
})
export class ZoomableImagesDirective {
  @Output() zoomableImages = new EventEmitter<string>();

  @HostListener('click', ['$event.target'])
  onClick(target: EventTarget | null): void {
    if (target instanceof HTMLImageElement) {
      this.zoomableImages.emit(target.src);
    }
  }
}
