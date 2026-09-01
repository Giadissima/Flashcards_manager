import { Component, Input } from '@angular/core';

/**
 * The score of a test drawn as one bar: correct, then wrong, then the track
 * showing what was never answered - the unanswered tail of a run still in
 * progress, or the questions a test ended early left blank.
 *
 * It is one element painted with a gradient and not one box per slice: side by
 * side, the seam between two boxes lands mid pixel at most widths and the
 * browser softens it, which reads as a step between the colours.
 *
 * Decorative on purpose (aria-hidden): every page drawing it states the same
 * counts in words next to it.
 *
 * Usage:
 *   <app-score-bar [correct]="5" [wrong]="4" [total]="10" size="sm"></app-score-bar>
 */
@Component({
  selector: 'app-score-bar',
  standalone: true,
  template: `<div class="score-bar" [class.score-bar--sm]="size === 'sm'"
    [style.background]="gradient" aria-hidden="true"></div>`,
  styleUrl: './score-bar.component.scss'
})
export class ScoreBarComponent {
  @Input({ required: true }) correct = 0;
  @Input({ required: true }) wrong = 0;
  @Input({ required: true }) total = 0;

  /** 'sm' for a bar inside a list row, 'md' for the one a page is built around. */
  @Input() size: 'sm' | 'md' = 'md';

  get gradient(): string {
    const correct = this.toPercent(this.correct);
    const answered = correct + this.toPercent(this.wrong);
    return `linear-gradient(to right,
      var(--success-color) 0 ${correct}%,
      var(--danger-color) ${correct}% ${answered}%,
      var(--track-background) ${answered}% 100%)`;
  }

  private toPercent(count: number): number {
    return this.total ? (count / this.total) * 100 : 0;
  }
}
