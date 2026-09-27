import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PendingButtonDirective } from '../../shared/pending-button.directive';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { emailMaxLength } from '../../../config/config';
import { waitErrorOf } from '../../shared/wait-error';

/**
 * Where a forgotten password starts. The server answers the same way whether
 * or not the address has an account (see PasswordResetService), so this page
 * only ever shows one of "sent" or "too many requests" - never "not found".
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule, RouterLink, PageCardComponent, PendingButtonDirective],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../auth-page.scss',
})
export class ForgotPasswordComponent {
  form: FormGroup;
  submitting = false;
  sent = false;
  /** Translation key of the failure shown above the form. */
  errorKey: string | null = null;
  errorParams: Record<string, unknown> = {};

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(emailMaxLength)]],
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorKey = null;
    try {
      await this.authService.forgotPassword(this.form.getRawValue().email.trim());
      // Shown regardless of whether the address exists: see the class doc.
      this.sent = true;
    } catch (error) {
      const wait = waitErrorOf(error);
      this.errorParams = wait?.params ?? {};
      this.errorKey = wait?.key ?? 'auth.error.generic';
    } finally {
      this.submitting = false;
    }
  }
}
