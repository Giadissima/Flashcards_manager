import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { bootstrapApplication } from '@angular/platform-browser';

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...(appConfig.providers ?? []),
    provideHttpClient(withInterceptorsFromDi()) // <- replaces HttpClientModule, registers HttpClient in the standalone DI system.
  ]
}).catch(err => console.error(err));

