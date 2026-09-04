import { ActivatedRoute, Router } from '@angular/router';

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {
  // Translation key for the message, overridable via query param
  // (?message=common.error.testNotFound) for specific cases like a missing test.
  messageKey = 'notFound.message';

  // The page is the generic error screen, not only the 404 one: the status
  // shown is overridable via query param (?code=409) for the cases where the
  // resource does exist but cannot be opened in the state it is in.
  code = '404';

  constructor(private route: ActivatedRoute, private router: Router) {
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) this.messageKey = message;
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) this.code = code;
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
