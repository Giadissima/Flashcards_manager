import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PasswordFieldComponent } from '../../shared/password-field/password-field.component';
import { PendingButtonDirective } from '../../shared/pending-button.directive';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { passwordMaxLength, passwordMinLength } from '../../../config/config';

/** What the page is doing, and what it has to say about it. */
type State = 'ready' | 'invalidLink' | 'done';

/**
 * Where a reset link lands. Outside the login guard for the same reason as
 * VerifyEmailComponent: the link is opened from an inbox, in a browser this
 * site may never have seen before, and the token in the address is the whole
 * of what proves anything.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    RouterLink,
    PageCardComponent,
    PasswordFieldComponent,
    PendingButtonDirective,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: '../auth-page.scss',
})
export class ResetPasswordComponent implements OnInit {
  state: State = 'ready';
  form: FormGroup;
  submitting = false;
  errorKey: string | null = null;

  readonly passwordMinLength = passwordMinLength;
  readonly passwordMaxLength = passwordMaxLength;

  private token = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(passwordMinLength), Validators.maxLength(passwordMaxLength)]],
      confirmPassword: ['', Validators.required],
    }, { validators: ResetPasswordComponent.passwordsMatch });
  }

  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    // A link cut in half by a mail client reads the same as an expired one:
    // there is nothing to send to the server either way.
    if (!token) {
      this.state = 'invalidLink';
      return;
    }
    this.token = token;
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorKey = null;
    try {
      await this.authService.resetPassword(this.token, this.form.getRawValue().newPassword);
      this.state = 'done';
      this.toastService.show(this.transloco.translate('auth.resetPassword.toastSuccess'), 'success');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error?.code === 'invalidToken') {
        this.state = 'invalidLink';
        return;
      }
      this.errorKey = 'auth.error.generic';
    } finally {
      this.submitting = false;
    }
  }
}
