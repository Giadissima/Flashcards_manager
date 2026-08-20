import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

export type LoadState = 'loading' | 'error' | 'ready';

// A 404 redirects to /not-found instead of showing the error block: the resource genuinely doesn't exist.
@Component({
  selector: 'app-load-state',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './load-state.component.html',
  styleUrl: './load-state.component.scss'
})
export class LoadStateComponent {
  @Input() errorMessageKey = 'common.error.load';
  @Input() offlineMessageKey = 'common.error.offline';
  @Input() serverErrorMessageKey = 'common.error.server';
  @Input() notFoundMessageKey = 'common.error.notFound';
  @Input() showRetry = true;
  @Input() showBackHome = true;

  state: LoadState = 'loading';

  // Resolved by the last run(): which message key the error block should render.
  displayedErrorKey = this.errorMessageKey;

  private task?: () => Promise<void>;

  constructor(private router: Router) {}

  async run(task: () => Promise<void>): Promise<void> {
    this.task = task;
    this.state = 'loading';
    try {
      await task();
      this.state = 'ready';
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.router.navigate(['/not-found'], { queryParams: { message: this.notFoundMessageKey } });
        return;
      }
      console.error('Load error', err);
      this.displayedErrorKey = this.resolveErrorKey(err);
      this.state = 'error';
    }
  }

  // status 0 = no connection reached the server (offline/CORS); >=500 = server/DB is up but failing.
  private resolveErrorKey(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return this.offlineMessageKey;
      if (err.status >= 500) return this.serverErrorMessageKey;
    }
    return this.errorMessageKey;
  }

  retry(): void {
    if (this.task) this.run(this.task);
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
