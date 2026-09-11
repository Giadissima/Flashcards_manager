import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { availableLanguages, readStoredLanguage } from './shared/language';
import { authInterceptor } from './auth/auth.interceptor';
import { langInterceptor } from './shared/lang.interceptor';

import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideNativeDateAdapter } from '@angular/material/core';
import { routes } from './app.routes';
import { TranslocoHttpLoader } from './transloco-http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // the Material datepicker needs a DateAdapter to turn Date <-> calendar text
    provideNativeDateAdapter(),
    // replaces HttpClientModule, registers HttpClient in the standalone DI system
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([authInterceptor, langInterceptor])),
    provideTransloco({
      config: {
        availableLangs: [...availableLanguages],
        defaultLang: readStoredLanguage(),
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
