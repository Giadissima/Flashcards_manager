import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, OnInit } from '@angular/core';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { TranslocoModule } from '@jsverse/transloco';

/** What the page is doing, and what it has to say about it. */
type State = 'ready' | 'checking' | 'done' | 'failed';

/**
 * Where a confirmation link lands.
 *
 * Outside the login guard on purpose: the link is opened from an inbox, which
 * is often another browser, or a phone that has never seen this site. The token
 * in the address is the whole of what proves anything, so the page works
 * logged out and simply offers the way in afterwards.
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, TranslocoModule, RouterLink, PageCardComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: '../auth-page.scss',
})
export class VerifyEmailComponent implements OnInit {
  state: State = 'ready';
  private token = '';

  /** Where the button underneath goes: home for whoever is already logged in. */
  get target(): string {
    return this.authService.isLoggedIn ? '/home' : '/login';
  }

  get targetKey(): string {
    return this.authService.isLoggedIn
      ? 'auth.verify.goHome'
      : 'auth.verify.goLogin';
  }

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    // An address with no token in it is a link that was cut in half by a mail
    // client, which reads the same way as one that has expired: the answer is
    // the same either way, ask for another mail.
    if (!token) {
      this.state = 'failed';
      return;
    }

    this.token = token;
  }

  // Left for an explicit click rather than fired on page load: mail
  // security scanners (Microsoft Safe Links and the like) open links
  // automatically to inspect them, which would otherwise spend the
  // single-use token before the person ever sees the page.
  async confirm(): Promise<void> {
    if (this.state === 'checking') return;
    this.state = 'checking';
    try {
      await this.authService.verifyEmail(this.token);
      this.state = 'done';
    } catch {
      this.state = 'failed';
    }
  }
}
