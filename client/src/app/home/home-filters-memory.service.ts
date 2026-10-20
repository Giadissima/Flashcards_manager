import { Injectable } from '@angular/core';
import { NavigationEnd, Params, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Remembers the query params (filters, sort, page) the home feed was last
 * shown with, so that leaving it for a create/edit page and coming back does
 * not throw them away. Held in memory only: a page reload starts clean.
 */
@Injectable({ providedIn: 'root' })
export class HomeFiltersMemory {
  private params: Params = {};

  constructor(router: Router) {
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const tree = router.parseUrl(router.url);
        if (tree.root.children['primary']?.segments[0]?.path === 'home') {
          this.params = tree.queryParams;
        }
      });
  }

  /** Query params to pass when navigating back to /home. */
  get homeParams(): Params {
    return this.params;
  }
}
