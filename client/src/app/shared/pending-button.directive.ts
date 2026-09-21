import { Directive, ElementRef, Input, OnChanges, OnInit, Renderer2 } from '@angular/core';

/**
 * Put on a <button> that triggers a server request: while [appPendingButton] is
 * true, its existing content (icon, text, whatever markup) is hidden in place -
 * keeping the button's width stable - and a spinning Material Symbols icon is
 * overlaid instead. Purely visual: pair it with [disabled]="... || pendingFlag"
 * on the same button so it can't actually be clicked (or Enter-submitted) twice.
 */
@Directive({
  selector: 'button[appPendingButton]',
  standalone: true,
})
export class PendingButtonDirective implements OnInit, OnChanges {
  @Input('appPendingButton') pending = false;

  private contentWrapper: HTMLElement | null = null;

  constructor(private el: ElementRef<HTMLButtonElement>, private renderer: Renderer2) {}

  ngOnInit(): void {
    const button = this.el.nativeElement;

    // A class, not the [appPendingButton] attribute: Angular consumes that
    // binding at compile time to match/instantiate this directive but does not
    // render it as an actual DOM attribute, so an attribute-selector in CSS
    // would never match. This class is a real DOM class the CSS can target.
    this.renderer.addClass(button, 'pending-button-host');

    // Move the button's existing children (elements AND bare text nodes) into a
    // wrapper span, so a plain CSS selector can hide the whole thing as one unit.
    this.contentWrapper = this.renderer.createElement('span');
    this.renderer.addClass(this.contentWrapper, 'pending-button-content');
    while (button.firstChild) {
      this.renderer.appendChild(this.contentWrapper, button.firstChild);
    }
    this.renderer.appendChild(button, this.contentWrapper);

    const spinner = this.renderer.createElement('span');
    this.renderer.addClass(spinner, 'material-symbols-outlined');
    this.renderer.addClass(spinner, 'pending-button-spinner');
    this.renderer.appendChild(spinner, this.renderer.createText('progress_activity'));
    this.renderer.appendChild(button, spinner);

    this.applyState();
  }

  ngOnChanges(): void {
    this.applyState();
  }

  private applyState(): void {
    const button = this.el.nativeElement;
    if (this.pending) {
      this.renderer.addClass(button, 'is-pending');
      this.renderer.setAttribute(button, 'aria-busy', 'true');
    } else {
      this.renderer.removeClass(button, 'is-pending');
      this.renderer.removeAttribute(button, 'aria-busy');
    }
  }
}
