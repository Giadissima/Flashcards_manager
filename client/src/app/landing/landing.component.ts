import { AppLanguage, availableLanguages, storeLanguage } from '../shared/language';

import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { DefinitionModalComponent, DefinitionTerm } from './definition-modal/definition-modal.component';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TrustHtmlPipe } from '../shared/trust-html.pipe';

/**
 * The one public, unauthenticated page of the app: reachable at '/' by anyone
 * not logged in (see the guestGuard route in app.routes.ts), meant to be
 * indexed by search engines. Everything else lives behind the login.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule, ClickOutsideDirective, DefinitionModalComponent, TrustHtmlPipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit, OnDestroy {
  isLanguageMenuOpen = false;
  readonly availableLanguages = availableLanguages;
  openDefinition: DefinitionTerm | null = null;

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
    // The tab title stays the fixed app name (same as everywhere else in the
    // app, see index.html) - only the SEO meta tags are translated.
    this.title.setTitle('Flashcards Manager');
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

  // The "flashcard", "spaced repetition" and "basic test" keywords are links
  // embedded in translation strings and rendered via [innerHTML] (see the i18n
  // files), so they can't carry an Angular (click) binding directly: delegate
  // from the surrounding section instead and read which term was clicked off
  // its data-term attribute.
  onFeatureClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest<HTMLElement>('a[data-term]');
    if (!link) return;
    event.preventDefault();
    this.openDefinition = link.getAttribute('data-term') as DefinitionTerm;
  }

  closeDefinitionModal(): void {
    this.openDefinition = null;
  }

  private updateSeoTags(): void {
    const metaTitle = this.transloco.translate('landing.metaTitle');
    const metaDescription = this.transloco.translate('landing.metaDescription');
    this.meta.updateTag({ name: 'description', content: metaDescription });
    this.meta.updateTag({ property: 'og:title', content: metaTitle });
    this.meta.updateTag({ property: 'og:description', content: metaDescription });
  }
}
