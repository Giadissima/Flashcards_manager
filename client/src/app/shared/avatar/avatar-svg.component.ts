import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { buildDefaultAvatarSvgMarkup, defaultAvatarColor } from './avatar.util';

/**
 * Default avatar: the "person" figure in white on a filled circle in the "fill"
 * colour. It reuses the very markup generated in avatar.util.ts, so the live
 * preview and the data URI used inside <img> tags always stay identical.
 */
@Component({
  selector: 'app-avatar-svg',
  standalone: true,
  template: `<div class="avatar-svg" [innerHTML]="svgHtml"></div>`,
  styleUrl: './avatar-svg.component.scss',
})
export class AvatarSvgComponent implements OnChanges {
  @Input() fill: string = defaultAvatarColor;

  svgHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(
      buildDefaultAvatarSvgMarkup(this.fill),
    );
  }
}
