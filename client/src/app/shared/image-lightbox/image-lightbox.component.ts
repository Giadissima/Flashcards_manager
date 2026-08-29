import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';

import { ModalComponent } from '../modal/modal.component';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Full-screen view of an image taken from stored content, with pan and zoom.
 *
 * Pair it with the zoomableImages directive on whatever container renders that
 * content, and call open() with the src it emits:
 *
 *   <div [innerHTML]="…" (zoomableImages)="lightbox.open($event)"></div>
 *   <app-image-lightbox #lightbox></app-image-lightbox>
 *
 * The dialog styling lives in styles.scss, not here: the classes go to
 * ModalComponent's own template through [dialogClass]/[contentClass], so they
 * would not survive this component's style scoping either.
 */
@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [ModalComponent, TranslocoModule],
  templateUrl: './image-lightbox.component.html',
})
export class ImageLightboxComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('image') imageRef?: ElementRef<HTMLImageElement>;

  isOpen = false;
  src: string | null = null;
  loading = false;

  private panzoom: PanzoomObject | null = null;
  private needsZoomInit = false;
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.panzoom?.zoomWithWheel(event);
  };

  /** Opens the lightbox on the given image. */
  open(src: string): void {
    this.loading = true;
    this.src = src;
    this.isOpen = true;
    this.needsZoomInit = true;
  }

  onImageLoaded(): void {
    this.loading = false;
  }

  onClosed(): void {
    this.destroyZoom();
  }

  ngAfterViewChecked(): void {
    // Reopening the same image doesn't change the [src] binding, so the browser
    // never fires another 'load' event - poll the native .complete flag instead,
    // which reflects the fetch state regardless of whether src actually changed.
    if (this.loading && this.imageRef?.nativeElement.complete) {
      this.loading = false;
    }

    // Wait for the image to actually finish loading: while loading is true the
    // <img> is display:none, so panzoom would measure a zero-size element.
    if (this.needsZoomInit && this.imageRef && !this.loading) {
      this.needsZoomInit = false;
      this.initZoom();
    }
  }

  ngOnDestroy(): void {
    this.destroyZoom();
  }

  zoomIn(): void {
    this.panzoom?.zoomIn();
  }

  zoomOut(): void {
    this.panzoom?.zoomOut();
  }

  resetZoom(): void {
    this.panzoom?.reset();
  }

  private initZoom(): void {
    const el = this.imageRef?.nativeElement;
    if (!el) return;
    this.destroyZoom();
    this.panzoom = Panzoom(el, {
      maxScale: 5,
      minScale: 1,
      contain: 'outside',
      step: 0.5,
    });
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private destroyZoom(): void {
    const el = this.imageRef?.nativeElement;
    el?.removeEventListener('wheel', this.onWheel);
    this.panzoom?.destroy();
    this.panzoom = null;
  }
}
