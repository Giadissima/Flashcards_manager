import { Component, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import { TutorialService } from './tutorial.service';

interface TutorialStep {
  icon: string;
  titleKey: string;
  textKey?: string;
  /** 1/2/3 badge on the three study-material steps: they are a strict chain
      (subject before topic before flashcard), not interchangeable options,
      so each one is numbered instead of just bulleted like the rest. */
  orderLabel?: string;
  /** Only on the "what is a flashcard" step: shows the front/back illustration. */
  illustration?: boolean;
}

// Mirrors the app's own sections, in the order a new account meets them: what
// a flashcard even is, first, then the study material chain - subject, then
// topic, then flashcard, each one impossible without the last - then testing,
// then community.
const STEPS: TutorialStep[] = [
  { icon: 'waving_hand', titleKey: 'tutorial.steps.welcome.title', textKey: 'tutorial.steps.welcome.text' },
  { icon: 'flip', titleKey: 'tutorial.steps.whatIsFlashcard.title', textKey: 'tutorial.steps.whatIsFlashcard.text', illustration: true },
  { icon: 'book_2', titleKey: 'tutorial.steps.subject.title', textKey: 'tutorial.steps.subject.text', orderLabel: '1' },
  { icon: 'sell', titleKey: 'tutorial.steps.topic.title', textKey: 'tutorial.steps.topic.text', orderLabel: '2' },
  { icon: 'style', titleKey: 'tutorial.steps.flashcards.title', textKey: 'tutorial.steps.flashcards.text', orderLabel: '3' },
  { icon: 'quiz', titleKey: 'tutorial.steps.test.title', textKey: 'tutorial.steps.test.text' },
  { icon: 'groups', titleKey: 'tutorial.steps.community.title', textKey: 'tutorial.steps.community.text' },
  { icon: 'settings', titleKey: 'tutorial.steps.settings.title', textKey: 'tutorial.steps.settings.text' },
];

@Component({
  selector: 'app-tutorial-modal',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ModalComponent],
  template: `
    <app-modal [isOpen]="isOpen" [title]="'tutorial.title' | transloco" [showFooter]="true" (closed)="close()">
      <div class="tutorial-step">
        <div class="tutorial-step-icon-wrap">
          <span class="material-symbols-outlined tutorial-step-icon">{{ step.icon }}</span>
          @if (step.orderLabel) {
          <span class="tutorial-step-order">{{ step.orderLabel }}</span>
          }
        </div>
        @if (step.orderLabel) {
        <div class="tutorial-step-eyebrow">{{ 'tutorial.step' | transloco:{ number: step.orderLabel } }}</div>
        }
        <h6 class="tutorial-step-title">{{ step.titleKey | transloco }}</h6>
        @if (step.textKey) {
        <p class="tutorial-step-text">{{ step.textKey | transloco }}</p>
        }
        @if (step.illustration) {
        <div class="tutorial-flashcard-illustration">
          <svg class="tutorial-flashcard-side" viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="5" y="18" width="120" height="114" rx="14" fill="var(--component-background)" stroke="var(--primary-color)" stroke-width="3"/>
            <rect x="19" y="34" width="50" height="16" rx="8" fill="var(--secondary-color)"/>
            <text x="44" y="46" font-size="8" font-weight="700" fill="var(--header-color)" text-anchor="middle">?</text>
            <line x1="19" y1="70" x2="103" y2="70" stroke="var(--border-color)" stroke-width="4" stroke-linecap="round"/>
            <line x1="19" y1="86" x2="87" y2="86" stroke="var(--border-color)" stroke-width="4" stroke-linecap="round"/>
            <line x1="19" y1="102" x2="95" y2="102" stroke="var(--border-color)" stroke-width="4" stroke-linecap="round"/>
          </svg>
          <span class="material-symbols-outlined tutorial-flip-icon">sync_alt</span>
          <svg class="tutorial-flashcard-side" viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="5" y="18" width="120" height="114" rx="14" fill="var(--component-background)" stroke="var(--success-color)" stroke-width="3" stroke-dasharray="7 6"/>
            <rect x="19" y="34" width="50" height="16" rx="8" fill="color-mix(in srgb, var(--success-color) 25%, transparent)"/>
            <text x="44" y="46" font-size="8" font-weight="700" fill="var(--success-color)" text-anchor="middle">&#10003;</text>
            <line x1="19" y1="70" x2="103" y2="70" stroke="var(--border-color)" stroke-width="4" stroke-linecap="round"/>
            <line x1="19" y1="86" x2="87" y2="86" stroke="var(--border-color)" stroke-width="4" stroke-linecap="round"/>
            <line x1="19" y1="102" x2="95" y2="102" stroke="var(--border-color)" stroke-width="4" stroke-linecap="round"/>
          </svg>
        </div>
        }
      </div>

      <div class="tutorial-dots">
        @for (s of steps; track s; let i = $index) {
        <span class="tutorial-dot" [class.active]="i === stepIndex"></span>
        }
      </div>

      <ng-container modal-footer>
        <button type="button" class="btn btn-outline-secondary" (click)="close()">
          {{ 'tutorial.skip' | transloco }}
        </button>
        <div class="tutorial-nav-buttons">
          @if (stepIndex > 0) {
          <button type="button" class="btn btn-outline-primary" (click)="previous()">
            <span class="material-symbols-outlined">arrow_back</span>
            {{ 'common.previous' | transloco }}
          </button>
          }
          @if (stepIndex < steps.length - 1) {
          <button type="button" class="btn btn-primary" (click)="next()">
            {{ 'common.next' | transloco }}
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
          } @else {
          <button type="button" class="btn btn-primary" (click)="finish()">
            <span class="material-symbols-outlined">check</span>
            {{ 'tutorial.finish' | transloco }}
          </button>
          }
        </div>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    .tutorial-step {
      text-align: center;
      padding: calc(var(--spacing-unit) * 2) 0;
    }
    .tutorial-step-icon-wrap {
      position: relative;
      display: inline-block;
    }
    .tutorial-step-icon {
      font-size: 3rem;
      color: var(--primary-color, #6c5ce7);
    }
    .tutorial-step-order {
      position: absolute;
      top: -4px;
      right: -10px;
      min-width: 20px;
      height: 20px;
      padding: 0 4px;
      border-radius: 50%;
      background: var(--primary-color, #6c5ce7);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tutorial-step-eyebrow {
      color: var(--primary-color, #6c5ce7);
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: calc(var(--spacing-unit) * 1.5);
    }
    .tutorial-step-title {
      font-weight: 700;
      color: var(--header-color);
      margin-top: calc(var(--spacing-unit) * 0.5);
    }
    .tutorial-step-text {
      color: var(--text-color);
      margin-bottom: 0;
    }
    .tutorial-flashcard-illustration {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: calc(var(--spacing-unit) * 1.5);
      margin-top: calc(var(--spacing-unit) * 1.5);
    }
    .tutorial-flashcard-side {
      width: 100%;
      max-width: 130px;
      height: auto;
      flex: 1 1 0;
    }
    .tutorial-flip-icon {
      flex: 0 0 auto;
      font-size: 1.75rem;
      color: var(--primary-color);
    }
    .tutorial-dots {
      display: flex;
      justify-content: center;
      gap: calc(var(--spacing-unit) * 0.75);
      margin-bottom: var(--spacing-unit);
    }
    .tutorial-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--border-color);
    }
    .tutorial-dot.active {
      background: var(--primary-color, #6c5ce7);
    }
    .modal-footer {
      justify-content: space-between;
    }
    .tutorial-nav-buttons {
      display: flex;
      gap: var(--spacing-unit);
    }
  `]
})
export class TutorialModalComponent implements OnInit, OnDestroy {
  readonly steps = STEPS;
  isOpen = false;
  stepIndex = 0;

  private subscription?: Subscription;

  constructor(private tutorialService: TutorialService, private router: Router) {}

  get step(): TutorialStep {
    return this.steps[this.stepIndex];
  }

  ngOnInit(): void {
    this.subscription = this.tutorialService.isOpen$.subscribe((open) => {
      this.isOpen = open;
      if (open) this.stepIndex = 0; // always restart from the beginning
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  next(): void {
    if (this.stepIndex < this.steps.length - 1) this.stepIndex++;
  }

  previous(): void {
    if (this.stepIndex > 0) this.stepIndex--;
  }

  close(): void {
    this.tutorialService.close();
  }

  // Only reached from the last step's own button, never from skip/X/backdrop/
  // escape (all of which go through close() above): completing the tour, not
  // just leaving it, is what should send a brand new account into its first
  // real action.
  finish(): void {
    this.tutorialService.close();
    this.router.navigate(['/create-subject']);
  }
}
