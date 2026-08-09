import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { buildDefaultSubjectIconSvgMarkup, defaultSubjectIconColor } from '../subject-icon.util';

/**
 * Icona SVG di default per le materie: cerchio pieno del colore "fill" con
 * il disegno (libro aperto "menu_book" specchiato + matita "edit") nello
 * stesso colore ma scurito di una percentuale fissa, per ottenere l'effetto
 * a due tonalità dell'icona originale senza dover passare due colori.
 * Riusa lo stesso markup generato in subject-icon.util.ts, così la preview
 * live e la data-URI usata negli <img> restano sempre identiche.
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
