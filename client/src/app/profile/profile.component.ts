import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StudyFields, StudyFieldsComponent, emptyStudyFields } from '../university/study-fields/study-fields.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { charMinLength, usernameMaxLength } from '../../config/config';
import { defaultAvatarColor, getAvatarUrl } from '../shared/avatar/avatar.util';
import { waitErrorOf } from '../shared/wait-error';

import { AuthService } from '../auth/auth.service';
import { AvatarSvgComponent } from '../shared/avatar/avatar-svg.component';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { IconPreviewComponent } from '../shared/icon-preview/icon-preview.component';
import { LoadStateComponent } from '../shared/load-state/load-state.component';
import { PageCardComponent } from '../shared/page-card/page-card.component';
import { Router } from '@angular/router';
import { ToastService } from '../shared/toast/toast.service';

/** Same rule as the server DTO: what is refused there is caught here first. */
const usernamePattern = /^[A-Za-z0-9._-]+$/;

/**
 * Where the account is edited after the fact. Without it the registration form
 * would be the only chance to give the study fields, which would make skipping
 * them permanent - and those two fields are what the Community section reads.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    PageCardComponent,
    LoadStateComponent,
    StudyFieldsComponent,
    IconPreviewComponent,
    AvatarSvgComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  profileForm: FormGroup;
  studyFields: StudyFields = emptyStudyFields();
  saving = false;
  /** Translation key of the failure shown above the form, cleared on each save. */
  errorKey: string | null = null;

  /** The address of the account, shown but not editable here: changing it
      would mean confirming a new one, which is a page of its own. */
  email: string | null = null;
  /** False only while the confirmation link is still unopened. */
  emailVerified = true;
  /** True while the "send it again" call is out, and after it went through:
      the mail is on its way, and pressing again would only make a second one. */
  resending = false;
  resent = false;

  selectedAvatar: File | null = null;
  /**
   * null means nothing is uploaded, so the live drawing is shown and follows the
   * colour picker; otherwise it is the picture, either the stored one or the
   * file just chosen.
   */
  previewUrl: string | null = null;
  /** True after a "reset" click: on save the stored picture has to be dropped. */
  private removeAvatar = false;

  readonly charMinLength = charMinLength;
  readonly usernameMaxLength = usernameMaxLength;

  get colorControl(): FormControl<string> {
    return this.profileForm.get('avatarColor') as FormControl<string>;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {
    this.profileForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(charMinLength),
        Validators.maxLength(usernameMaxLength),
        Validators.pattern(usernamePattern),
      ]],
      avatarColor: [defaultAvatarColor, Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadState.run(() => this.loadProfile());
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  private async loadProfile(): Promise<void> {
    // Asked for rather than read from storage: the copy kept there is only a
    // convenience, and this is the page that edits the real thing.
    const user = await this.authService.fetchMe();
    this.profileForm.patchValue({
      username: user.username,
      avatarColor: user.avatarColor ?? defaultAvatarColor,
    });
    this.studyFields = {
      universityCode: user.universityCode ?? null,
      course: user.course ?? null,
      courseKind: user.courseKind ?? null,
    };
    this.previewUrl = user.avatar ? getAvatarUrl(user) : null;
    this.email = user.email ?? null;
    this.emailVerified = user.emailVerified;
  }

  /**
   * Asks the server for the confirmation mail again.
   *
   * The button does not come back: whatever happened, one more mail is either
   * on its way or was refused for asking too often, and a button that can be
   * pressed all afternoon is how an address ends up marked as spam.
   */
  async resendVerification(): Promise<void> {
    if (this.resending || this.resent) return;
    this.resending = true;

    try {
      await this.authService.resendVerification();
      this.resent = true;
      this.toastService.show(this.transloco.translate('auth.verify.resent'), 'success');
    } catch (error) {
      // Asked too often is not a failure to report: it says exactly how long
      // to wait, and that is worth more than a message telling them to retry
      // blind while the button stays disabled either way.
      const wait = waitErrorOf(error);
      this.toastService.show(
        wait
          ? this.transloco.translate(wait.key, wait.params)
          : this.transloco.translate('auth.verify.resendError'),
        'error'
      );
    } finally {
      this.resending = false;
    }
  }

  // Already cropped by app-icon-preview: what arrives here is the picture as it
  // will be stored, not the file the user picked.
  onAvatarSelected(file: File): void {
    this.removeAvatar = false;
    this.revokePreviewUrl();
    this.selectedAvatar = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  /** Back to the live drawing, which follows the colour picker. */
  resetAvatar(): void {
    this.removeAvatar = true;
    this.revokePreviewUrl();
    this.selectedAvatar = null;
    this.previewUrl = null;
  }

  private revokePreviewUrl(): void {
    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  async save(): Promise<void> {
    if (this.profileForm.invalid || this.saving) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorKey = null;

    const formData = new FormData();
    formData.append('username', this.profileForm.get('username')?.value);
    formData.append('avatarColor', this.profileForm.get('avatarColor')?.value);

    const { universityCode, course, courseKind } = this.studyFields;
    if (universityCode) formData.append('universityCode', universityCode);
    if (course && courseKind) {
      formData.append('course', course);
      formData.append('courseKind', courseKind);
    }

    if (this.selectedAvatar) {
      formData.append('avatar', this.selectedAvatar, this.selectedAvatar.name);
    } else if (this.removeAvatar) {
      formData.append('removeAvatar', 'true');
    }

    try {
      await this.authService.updateProfile(formData);
      this.selectedAvatar = null;
      this.removeAvatar = false;
      this.toastService.show(this.transloco.translate('profile.toast.saved'), 'success');
      this.router.navigate(['/home']);
    } catch (error) {
      this.errorKey = error instanceof HttpErrorResponse && error.status === 409
        ? 'auth.error.usernameTaken'
        : 'profile.toast.saveError';
    } finally {
      this.saving = false;
    }
  }

  /** Leaves without saving: the form is thrown away as it stands. */
  cancel(): void {
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.authService.logout();
    this.toastService.show(this.transloco.translate('auth.toast.loggedOut'), 'info');
  }
}
