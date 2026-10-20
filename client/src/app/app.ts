import { AuthService } from './auth/auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { NavbarComponent } from './navbar/navbar.component';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from './shared/theme/theme.service';
import { Toast } from './shared/toast/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, Toast],
  templateUrl: './app.html',
})
export class App {
  protected title = 'client';

  // ThemeService is injected here for its constructor alone: it is what puts
  // data-theme on <html>, and asking for it at the root means the stored theme
  // is applied on every page. Left to the settings modal, which is the only
  // other place that injects it, the login and register pages would come up
  // light whatever the user had chosen, since the navbar holding that modal is
  // not drawn while logged out.
  constructor(
    protected authService: AuthService,
    private themeService: ThemeService,
    router: Router,
    meta: Meta,
  ) {
    // The page is one document for the whole session, so the robots tag has to
    // be set and removed on each navigation or it would stick to the next page.
    router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      let route = router.routerState.snapshot.root;
      while (route.firstChild) route = route.firstChild;
      if (route.data['noindex']) {
        meta.updateTag({ name: 'robots', content: 'noindex, follow' });
      } else {
        meta.removeTag('name="robots"');
      }
    });
  }
}
