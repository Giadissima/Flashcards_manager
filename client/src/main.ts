import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { bootstrapApplication } from '@angular/platform-browser';

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...(appConfig.providers ?? []),
    // TODO aggiungere interceptor errori
    provideHttpClient(withInterceptorsFromDi()) // <- sostituisce HttpClientModule, registra HttpClient nel DI system standalone.
  ]
}).catch(err => console.error(err));
