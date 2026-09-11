import { HttpInterceptorFn } from '@angular/common/http';
import { readStoredLanguage } from './language';

/**
 * Carries the app's active language to the server as Accept-Language, so the
 * confirmation mail (the one thing the site sends outside itself) reads in
 * whatever language the reader chose instead of always Italian.
 */
export const langInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'Accept-Language': readStoredLanguage() } }));
