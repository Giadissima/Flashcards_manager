import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { inject } from '@angular/core';

/**
 * Guards every page of the app: without a token the user is sent to the login,
 * carrying where they were headed so they land there once they are in.
 */
export const authGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) return true;
  return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
};

/** The other way round: an already logged user has nothing to do on the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isLoggedIn ? router.createUrlTree(['/home']) : true;
};
