import { Component, OnDestroy, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/** Public, unguarded legal page linked from the landing page footer. */
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss',
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
  readonly telegramContactUrl = 'https://t.me/giadissima1234';

  private langChangeSub?: Subscription;

  constructor(
    private transloco: TranslocoService,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.updateSeoTags();
    this.langChangeSub = this.transloco.langChanges$.subscribe(() => this.updateSeoTags());
  }

  ngOnDestroy(): void {
    this.langChangeSub?.unsubscribe();
  }

  private updateSeoTags(): void {
    const metaTitle = this.transloco.translate('privacyPolicy.metaTitle');
    this.title.setTitle(metaTitle);
  }
}
