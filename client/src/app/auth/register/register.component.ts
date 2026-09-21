import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { waitErrorOf } from '../../shared/wait-error';
import { StudyFields, StudyFieldsComponent, emptyStudyFields } from '../../university/study-fields/study-fields.component';
import { charMinLength, emailMaxLength, passwordMaxLength, passwordMinLength, usernameMaxLength } from '../../../config/config';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PendingButtonDirective } from '../../shared/pending-button.directive';
import { RegistrationPayload } from '../../models/auth.dto';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TutorialService } from '../../shared/tutorial/tutorial.service';

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
    PendingButtonDirective,
  ],
  templateUrl: './register.component.html',
  styleUrl: '../auth-page.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;
  submitting = false;
  /** Translation key of the failure shown above the form, cleared on each try. */
  errorKey: string | null = null;
  /** What the message needs, when it needs anything: the wait, in minutes. */
  errorParams: Record<string, unknown> = {};

  studyFields: StudyFields = emptyStudyFields();

  readonly charMinLength = charMinLength;
  readonly usernameMaxLength = usernameMaxLength;
  readonly emailMaxLength = emailMaxLength;
  readonly passwordMinLength = passwordMinLength;
  readonly passwordMaxLength = passwordMaxLength;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService,
    private transloco: TranslocoService,
    private tutorialService: TutorialService,
  ) {
    this.registerForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(charMinLength),
        Validators.maxLength(usernameMaxLength),
        Validators.pattern(usernamePattern),
      ]],
      // Angular's own address check, which is the loose one on purpose: the
      // only test that means anything is whether the confirmation mail arrives.
      email: ['', [Validators.required, Validators.email, Validators.maxLength(emailMaxLength)]],
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
    const { username, email, password } = this.registerForm.getRawValue();
    const { universityCode, course, courseKind } = this.studyFields;

    const payload: RegistrationPayload = { username, email: email.trim(), password };
    if (universityCode) payload.universityCode = universityCode;
    if (course && courseKind) {
      payload.course = course;
      payload.courseKind = courseKind;
    }

    try {
      await this.authService.register(payload);
      // The account is ready; the mail is the one thing still outstanding, so
      // the welcome says where to look for it.
      this.toastService.show(this.transloco.translate('auth.toast.registered'), 'success');
      this.router.navigate(['/home']);
      // First thing a brand new account sees on /home: a quick tour of the app.
      this.tutorialService.open();
    } catch (error) {
      // An address that has asked too often is told how long to wait, not that
      // something went wrong: waiting is the whole of what it has to do.
      const wait = waitErrorOf(error);
      if (wait) {
        this.errorKey = wait.key;
        this.errorParams = wait.params;
        return;
      }

      this.errorParams = {};
      // A 409 says one of the two unique fields is taken, and which: sending
      // somebody to change their username when it was the address that clashed
      // is a loop they cannot get out of.
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.errorKey = error.error?.code === 'emailTaken'
          ? 'auth.error.emailTaken'
          : 'auth.error.usernameTaken';
        return;
      }
      this.errorKey = 'auth.error.generic';
    } finally {
      this.submitting = false;
    }
  }
}
