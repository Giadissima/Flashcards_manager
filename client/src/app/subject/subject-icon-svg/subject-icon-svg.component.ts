import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { buildDefaultSubjectIconSvgMarkup, defaultSubjectIconColor } from '../subject-icon.util';

/**
 * Default SVG icon for subjects: a filled circle in the "fill" color with the
 * drawing (mirrored "menu_book" open book + "edit" pencil) in the same color,
 * darkened by a fixed percentage, to get the two-tone look of the original icon
 * without having to pass two colors.
 * It reuses the very markup generated in subject-icon.util.ts, so the live
 * preview and the data-URI used inside <img> tags always stay identical.
 */
@Component({
  selector: 'app-subject-icon-svg',
  standalone: true,
  template: `<div class="subject-icon-svg" [innerHTML]="svgHtml"></div>`,
  styleUrl: './subject-icon-svg.component.scss',
})
export class SubjectIconSvgComponent implements OnChanges {
  @Input() fill: string = defaultSubjectIconColor;
  @Input() darkenPercent = 25;

  svgHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(
      buildDefaultSubjectIconSvgMarkup(this.fill, this.darkenPercent),
    );
  }
}
