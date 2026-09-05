import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { charMinLength, passwordMaxLength, passwordMinLength, usernameMaxLength } from '../../../config/config';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule, RouterLink, PageCardComponent],
  templateUrl: './login.component.html',
  styleUrl: '../auth-page.scss',
})
export class LoginComponent {
  loginForm: FormGroup;
  submitting = false;
  /** Translation key of the failure shown above the form, cleared on each try. */
  errorKey: string | null = null;

  readonly charMinLength = charMinLength;
  readonly usernameMaxLength = usernameMaxLength;
  readonly passwordMinLength = passwordMinLength;
  readonly passwordMaxLength = passwordMaxLength;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(usernameMaxLength)]],
      password: ['', [Validators.required, Validators.minLength(passwordMinLength), Validators.maxLength(passwordMaxLength)]],
    });
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid || this.submitting) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorKey = null;
    try {
      await this.authService.login(this.loginForm.getRawValue());
      this.toastService.show(
        this.transloco.translate('auth.toast.loggedIn', { username: this.authService.user?.username }),
        'success'
      );
      // Back to the page the guard turned away, or home when they came straight here
      const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
      this.router.navigateByUrl(redirectTo || '/home');
    } catch (error) {
      this.errorKey = error instanceof HttpErrorResponse && error.status === 401
        ? 'auth.error.wrongCredentials'
        : 'auth.error.generic';
    } finally {
      this.submitting = false;
    }
  }
}
