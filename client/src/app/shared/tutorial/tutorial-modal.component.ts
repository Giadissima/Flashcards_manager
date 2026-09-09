import { Component, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';
import { Subscription } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import { TutorialService } from './tutorial.service';

interface TutorialStep {
  icon: string;
  titleKey: string;
  /** Absent on the three study-material steps: the title alone carries them. */
  textKey?: string;
  /** 1/2/3 badge on the three study-material steps: they are a strict chain
      (subject before topic before flashcard), not interchangeable options,
      so each one is numbered instead of just bulleted like the rest. */
  orderLabel?: string;
}

// Mirrors the app's own sections, in the order a new account meets them: study
// material first - subject, then topic, then flashcard, each one impossible
// without the last - then testing, then community.
const STEPS: TutorialStep[] = [
  { icon: 'waving_hand', titleKey: 'tutorial.steps.welcome.title', textKey: 'tutorial.steps.welcome.text' },
  { icon: 'book_2', titleKey: 'tutorial.steps.subject.title', orderLabel: '1' },
  { icon: 'sell', titleKey: 'tutorial.steps.topic.title', orderLabel: '2' },
  { icon: 'style', titleKey: 'tutorial.steps.flashcards.title', orderLabel: '3' },
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
          <button type="button" class="btn btn-primary" (click)="close()">
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

  constructor(private tutorialService: TutorialService) {}

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
}
