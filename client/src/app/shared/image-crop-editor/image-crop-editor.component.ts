import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { ImageCroppedEvent, ImageCropperComponent, ImageTransform } from 'ngx-image-cropper';

import { ModalComponent } from '../modal/modal.component';
import { TranslocoModule } from '@jsverse/transloco';

// The crop is round on screen but square on disk: the icon is displayed inside
// a circle everywhere it appears, so cutting the corners away here would only
// throw pixels out without changing what is seen.
const OUTPUT_SIZE = 512;

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

/**
 * Round crop of an image the user has just picked, with zoom and drag.
 *
 * The crop circle itself is fixed and it is the image that moves under it,
 * which is what makes the frame a preview of the result: what fills the circle
 * is what gets saved.
 *
 * Hold it with a template reference and open it with the chosen file:
 *
 *   <app-image-crop-editor #cropEditor (cropped)="…"></app-image-crop-editor>
 *
 * The pan and zoom come from ngx-image-cropper, not from the panzoom setup of
 * image-lightbox: the lightbox moves an <img> around freely, while here the
 * movement has to stay tied to the crop box the library computes the output
 * from. What is shared with the lightbox is the chrome around it - the same
 * modal and the same three zoom controls, so the two read as the same tool.
 */
@Component({
  selector: 'app-image-crop-editor',
  standalone: true,
  imports: [ModalComponent, ImageCropperComponent, TranslocoModule],
  templateUrl: './image-crop-editor.component.html',
  styleUrl: './image-crop-editor.component.scss',
})
export class ImageCropEditorComponent {
  /** The cropped image, as a file ready to be uploaded in place of the original. */
  @Output() cropped = new EventEmitter<File>();
  /** Closed without cropping: the caller should drop the file it was opened with. */
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('cropper') cropper?: ImageCropperComponent;

  readonly outputSize = OUTPUT_SIZE;
  readonly minScale = MIN_SCALE;
  readonly maxScale = MAX_SCALE;
  // Finer than the step of the buttons: the slider is the control for settling
  // on a size, the buttons for getting there in a couple of clicks.
  readonly scaleStep = ZOOM_STEP / 5;

  isOpen = false;
  imageFile: File | null = null;
  transform: ImageTransform = { scale: 1 };
  loadFailed = false;

  private lastCrop: ImageCroppedEvent | null = null;
  // Set while confirming, so the close that follows is not read as a cancel.
  private confirming = false;

  /** Opens the editor on a freshly picked file. */
  open(file: File): void {
    this.imageFile = file;
    this.transform = { scale: 1 };
    this.lastCrop = null;
    this.loadFailed = false;
    this.confirming = false;
    this.isOpen = true;
  }

  onImageCropped(event: ImageCroppedEvent): void {
    this.lastCrop = event;
  }

  onLoadFailed(): void {
    this.loadFailed = true;
  }

  confirm(): void {
    const blob = this.lastCrop?.blob;
    if (!blob || !this.imageFile) return;
    this.confirming = true;
    this.cropped.emit(this.toFile(blob, this.imageFile.name));
    this.close();
  }

  cancel(): void {
    this.close();
  }

  // Reached by the confirm and cancel buttons alike, but also by the close
  // button, the backdrop and Escape, which the modal handles on its own.
  onClosed(): void {
    if (!this.confirming) this.cancelled.emit();
    this.imageFile = null;
    this.lastCrop = null;
  }

  // The slider drives the same scale as the buttons, so the two stay in step:
  // it reads the scale back through [value] on every change detection.
  onScaleInput(event: Event): void {
    this.setScale(Number((event.target as HTMLInputElement).value));
  }

  zoomIn(): void {
    this.setScale((this.transform.scale ?? 1) + ZOOM_STEP);
  }

  zoomOut(): void {
    this.setScale((this.transform.scale ?? 1) - ZOOM_STEP);
  }

  /** Back to the whole image, centred, as it was when the editor opened. */
  resetZoom(): void {
    this.transform = { scale: 1 };
    this.cropper?.resetCropperPosition();
  }

  // The wheel zooms instead of scrolling the modal behind the image, as it does
  // in the lightbox. The direction only is taken from the event: zooming by the
  // reported delta would move at a different speed on every input device.
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private setScale(scale: number): void {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    // A new object, not a mutation: the cropper picks the transform up through
    // ngOnChanges, which never runs if the same reference is handed back.
    this.transform = { ...this.transform, scale: clamped };
  }

  private close(): void {
    this.isOpen = false;
    this.onClosed();
  }

  // PNG whatever came in: the source can be a format the browser cannot write
  // back, and the icons are small enough that the size hardly matters.
  private toFile(blob: Blob, sourceName: string): File {
    const baseName = sourceName.replace(/[.][^.]*$/, '') || 'icon';
    return new File([blob], `${baseName}.png`, { type: blob.type || 'image/png' });
  }
}
