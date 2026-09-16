import { AppLanguage, availableLanguages, storeLanguage } from '../shared/language';

import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/**
 * The one public, unauthenticated page of the app: reachable at '/' by anyone
 * not logged in (see the guestGuard route in app.routes.ts), meant to be
 * indexed by search engines. Everything else lives behind the login.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule, ClickOutsideDirective],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit, OnDestroy {
  isLanguageMenuOpen = false;
  readonly availableLanguages = availableLanguages;

  private langChangeSub?: Subscription;

  constructor(
    private transloco: TranslocoService,
    private title: Title,
    private meta: Meta,
  ) {}

  get currentLanguage(): AppLanguage {
    return this.transloco.getActiveLang() as AppLanguage;
  }

  get screenshotUrl(): string {
    return this.currentLanguage === 'en'
      ? 'assets/landing-screenshot-en.png'
      : 'assets/landing-screenshot.png';
  }

  ngOnInit(): void {
    this.updateSeoTags();
    // Re-run whenever the language changes, whether from this page's own
    // switcher or from a value already stored from a previous visit.
    this.langChangeSub = this.transloco.langChanges$.subscribe(() => this.updateSeoTags());
  }

  ngOnDestroy(): void {
    this.langChangeSub?.unsubscribe();
  }

  toggleLanguageMenu(): void {
    this.isLanguageMenuOpen = !this.isLanguageMenuOpen;
  }

  closeLanguageMenu(): void {
    this.isLanguageMenuOpen = false;
  }

  setLanguage(language: AppLanguage): void {
    storeLanguage(language);
    this.transloco.setActiveLang(language);
    this.closeLanguageMenu();
  }

  private updateSeoTags(): void {
    const metaTitle = this.transloco.translate('landing.metaTitle');
    const metaDescription = this.transloco.translate('landing.metaDescription');
    this.title.setTitle(metaTitle);
    this.meta.updateTag({ name: 'description', content: metaDescription });
    this.meta.updateTag({ property: 'og:title', content: metaTitle });
    this.meta.updateTag({ property: 'og:description', content: metaDescription });
  }
}
