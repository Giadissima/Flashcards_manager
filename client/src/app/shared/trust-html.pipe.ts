import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marks a string as trusted HTML, skipping Angular's [innerHTML] sanitizer.
 * Angular's sanitizer strips attributes it doesn't recognize (e.g. `data-*`),
 * which breaks static content that relies on them (see the landing page's
 * definition-modal triggers). Only use this on content the app itself
 * controls, never on anything derived from user input.
 */
@Pipe({
  name: 'trustHtml',
  standalone: true,
})
export class TrustHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
