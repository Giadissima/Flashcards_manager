import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

import { ModalComponent } from '../../shared/modal/modal.component';

/** One rule: a short heading and the sentence explaining what it covers. */
interface RuleItem {
  titleKey: string;
  bodyKey: string;
}

/**
 * What is and isn't allowed in the Community: shown on demand from the page
 * header, and once on its own the first time a reader opens the Community.
 */
@Component({
  selector: 'app-community-rules-modal',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ModalComponent],
  templateUrl: './community-rules-modal.component.html',
  styleUrl: './community-rules-modal.component.scss',
})
export class CommunityRulesModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  readonly rules: RuleItem[] = [
    { titleKey: 'respectTitle', bodyKey: 'respectBody' },
    { titleKey: 'contentTitle', bodyKey: 'contentBody' },
    { titleKey: 'spamTitle', bodyKey: 'spamBody' },
    { titleKey: 'relevanceTitle', bodyKey: 'relevanceBody' },
    { titleKey: 'plagiarismTitle', bodyKey: 'plagiarismBody' },
    { titleKey: 'accuracyTitle', bodyKey: 'accuracyBody' },
    { titleKey: 'privacyTitle', bodyKey: 'privacyBody' },
    { titleKey: 'fraudTitle', bodyKey: 'fraudBody' },
    { titleKey: 'manipulationTitle', bodyKey: 'manipulationBody' },
  ];

  close(): void {
    this.closed.emit();
  }
}
