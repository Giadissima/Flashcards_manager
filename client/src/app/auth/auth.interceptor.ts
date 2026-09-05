import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';

import { AuthService } from './auth.service';
import { catchError } from 'rxjs/operators';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

/** Login and register: the two calls made precisely because there is no token yet. */
const isCredentialsRequest = (url: string): boolean =>
  url.includes('/auth/login') || url.includes('/auth/register');

/**
 * Signs every call with the token and ends the session on the first 401, so an
 * expired token cannot leave the app showing pages it can no longer load.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;

  const request = token && !isCredentialsRequest(req.url)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // A 401 on the login is a wrong password, which the page reports itself:
      // only a rejected token means the session is over.
      if (error.status === 401 && !isCredentialsRequest(req.url) && auth.isLoggedIn) {
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};
