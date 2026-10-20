import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

// Pages a list is left for and comes back from: while the user is on one of
// them (or on a list itself) the remembered state is kept.
const KEEP_PREFIXES = ['create-', 'edit-', 'manage-'];

/**
 * In-memory state of the manage-* lists (search term, subject filter, page),
 * kept while the user goes to a create/edit page and back so that returning
 * does not reset what they were looking at. Navigating anywhere else drops it,
 * so a later visit through the menu starts from a clean list.
 */
@Injectable({ providedIn: 'root' })
export class ListStateMemory {
  private states = new Map<string, unknown>();

  constructor(router: Router) {
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const first = router.parseUrl(router.url).root.children['primary']?.segments[0]?.path ?? '';
        if (!KEEP_PREFIXES.some((prefix) => first.startsWith(prefix))) {
          this.states.clear();
        }
      });
  }

  save<T>(key: string, state: T): void {
    this.states.set(key, state);
  }

  /** Returns the remembered state once; a second call gets nothing. */
  take<T>(key: string): T | undefined {
    const state = this.states.get(key) as T | undefined;
    this.states.delete(key);
    return state;
  }
}
