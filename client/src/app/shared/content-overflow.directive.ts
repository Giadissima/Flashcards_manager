import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
} from '@angular/core';

/**
 * Put on a clamped container: emits true while its content is taller than the
 * space the clamp leaves it, false once it fits. Used to show an "expand"
 * control only on the cards that actually need one.
 *
 * The measurement has to be redone in three cases, hence the three observers:
 * the container changes width (the grid reflows), its content is replaced (the
 * card flips between question and answer, through [innerHTML]), or an image
 * inside it finishes loading and only then takes up its real height.
 */
@Directive({
  selector: '[contentOverflow]',
  standalone: true,
})
export class ContentOverflowDirective implements AfterViewInit, OnDestroy {
  @Output() contentOverflow = new EventEmitter<boolean>();

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  // Emitting only on a change keeps the host from re-rendering on every
  // observer callback, and stops a measurement loop: showing the control
  // changes the layout, which would measure again.
  private lastEmitted: boolean | null = null;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;

    // Outside Angular: these fire on every scroll-driven reflow and would
    // otherwise trigger change detection each time. The emit below re-enters.
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(this.measure);
      this.resizeObserver.observe(element);

      this.mutationObserver = new MutationObserver(this.measure);
      this.mutationObserver.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // 'load' does not bubble, so it is caught on the capture phase.
      element.addEventListener('load', this.measure, true);
    });

    this.measure();
  }

  private measure = (): void => {
    const element = this.host.nativeElement;
    // The rounding slack keeps a sub-pixel line height from reading as overflow.
    const overflows = element.scrollHeight - element.clientHeight > 1;

    if (overflows === this.lastEmitted) return;
    this.lastEmitted = overflows;
    this.zone.run(() => this.contentOverflow.emit(overflows));
  };

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.host.nativeElement.removeEventListener('load', this.measure, true);
  }
}
