import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { waitErrorOf } from '../../shared/wait-error';
import { StudyFields, StudyFieldsComponent, emptyStudyFields } from '../../university/study-fields/study-fields.component';
import { charMinLength, emailMaxLength, passwordMaxLength, passwordMinLength, usernameMaxLength } from '../../../config/config';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { PasswordFieldComponent } from '../../shared/password-field/password-field.component';
import { PendingButtonDirective } from '../../shared/pending-button.directive';
import { ProfileType, RegistrationPayload } from '../../models/auth.dto';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
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
    PasswordFieldComponent,
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

  /**
   * 1: account basics. 2: profile type, and study fields for a university
   * student. 3: the confirmation mail is on its way - shown in place of the
   * form rather than navigating straight off, so the "check your inbox"
   * message is not just a toast that can be missed.
   */
  step: 1 | 2 | 3 = 1;

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
      profileType: [null as ProfileType | null, Validators.required],
    }, { validators: RegisterComponent.passwordsMatch });
  }

  // On the group, not on the field: it is the pair that is either right or wrong
  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
  }

  /** Only the fields step 1 actually shows - profileType belongs to step 2,
      and checking the whole form here would refuse "Avanti" before it is even asked. */
  get step1Invalid(): boolean {
    const form = this.registerForm;
    return (
      form.get('username')!.invalid ||
      form.get('email')!.invalid ||
      form.get('password')!.invalid ||
      form.get('confirmPassword')!.invalid ||
      form.hasError('passwordMismatch')
    );
  }

  goToStep2(): void {
    if (this.step1Invalid) {
      ['username', 'email', 'password', 'confirmPassword'].forEach((name) => this.registerForm.get(name)?.markAsTouched());
      return;
    }
    this.step = 2;
  }

  goToStep1(): void {
    this.step = 1;
  }

  selectProfileType(type: ProfileType): void {
    this.registerForm.get('profileType')?.setValue(type);
    // Study fields belong to a university student alone: switching away from
    // it drops whatever was picked, so it cannot ride along in the payload.
    if (type !== 'university') {
      this.studyFields = emptyStudyFields();
    }
  }

  async register(): Promise<void> {
    if (this.step === 1) {
      this.goToStep2();
      return;
    }

    if (this.registerForm.invalid || this.submitting) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorKey = null;
    const { username, email, password, profileType } = this.registerForm.getRawValue();

    const payload: RegistrationPayload = { username, email: email.trim(), password, profileType };
    if (profileType === 'university') {
      const { universityCode, course, courseKind } = this.studyFields;
      if (universityCode) payload.universityCode = universityCode;
      if (course && courseKind) {
        payload.course = course;
        payload.courseKind = courseKind;
      }
    }

    try {
      await this.authService.register(payload);
      // The account exists, but there is still the mail to confirm - said as
      // its own step rather than a toast that can be missed and never seen again.
      this.step = 3;
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

  /** Leaves step 3 for the app itself, once the confirmation mail has been read about. */
  goHome(): void {
    this.router.navigate(['/home']);
    // First thing a brand new account sees on /home: a quick tour of the app.
    this.tutorialService.open();
  }
}
