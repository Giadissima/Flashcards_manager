import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { StudyFields, StudyFieldsComponent, emptyStudyFields } from '../../university/study-fields/study-fields.component';
import { charMinLength, passwordMaxLength, passwordMinLength, usernameMaxLength } from '../../../config/config';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { RegistrationPayload } from '../../models/auth.dto';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/** Same rule as the server DTO: what is refused there is caught here first. */
const usernamePattern = /^[A-Za-z0-9._-]+$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    RouterLink,
    PageCardComponent,
    StudyFieldsComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: '../auth-page.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;
  submitting = false;
  /** Translation key of the failure shown above the form, cleared on each try. */
  errorKey: string | null = null;

  studyFields: StudyFields = emptyStudyFields();

  readonly charMinLength = charMinLength;
  readonly usernameMaxLength = usernameMaxLength;
  readonly passwordMinLength = passwordMinLength;
  readonly passwordMaxLength = passwordMaxLength;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {
    this.registerForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(charMinLength),
        Validators.maxLength(usernameMaxLength),
        Validators.pattern(usernamePattern),
      ]],
      password: ['', [Validators.required, Validators.minLength(passwordMinLength), Validators.maxLength(passwordMaxLength)]],
      confirmPassword: ['', Validators.required],
    }, { validators: RegisterComponent.passwordsMatch });
  }

  // On the group, not on the field: it is the pair that is either right or wrong
  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
  }

  async register(): Promise<void> {
    if (this.registerForm.invalid || this.submitting) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorKey = null;
    const { username, password } = this.registerForm.getRawValue();
    const { universityCode, course, courseKind } = this.studyFields;

    const payload: RegistrationPayload = { username, password };
    if (universityCode) payload.universityCode = universityCode;
    if (course && courseKind) {
      payload.course = course;
      payload.courseKind = courseKind;
    }

    try {
      await this.authService.register(payload);
      this.toastService.show(this.transloco.translate('auth.toast.registered'), 'success');
      this.router.navigate(['/home']);
    } catch (error) {
      this.errorKey = error instanceof HttpErrorResponse && error.status === 409
        ? 'auth.error.usernameTaken'
        : 'auth.error.generic';
    } finally {
      this.submitting = false;
    }
  }
}
