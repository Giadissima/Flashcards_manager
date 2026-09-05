import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { availableLanguages, readStoredLanguage } from './shared/language';
import { authInterceptor } from './auth/auth.interceptor';

import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { TranslocoHttpLoader } from './transloco-http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // replaces HttpClientModule, registers HttpClient in the standalone DI system
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([authInterceptor])),
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
