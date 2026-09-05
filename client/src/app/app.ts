import { AuthService } from './auth/auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavbarComponent } from './navbar/navbar.component';
import { RouterOutlet } from '@angular/router';
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
  constructor(protected authService: AuthService, private themeService: ThemeService) {}
}
