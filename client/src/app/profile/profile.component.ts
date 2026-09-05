import { Component, OnInit, ViewChild } from '@angular/core';
import { StudyFields, StudyFieldsComponent, emptyStudyFields } from '../university/study-fields/study-fields.component';

import { AuthService } from '../auth/auth.service';
import { CommonModule } from '@angular/common';
import { LoadStateComponent } from '../shared/load-state/load-state.component';
import { PageCardComponent } from '../shared/page-card/page-card.component';
import { StudyFieldsPayload } from '../models/auth.dto';
import { ToastService } from '../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/**
 * Where the study fields can be filled in after the fact. Without it the only
 * chance to give them is the registration form, which makes skipping them
 * permanent - and the Community section reads exactly those two fields.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, TranslocoModule, PageCardComponent, LoadStateComponent, StudyFieldsComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  username = '';
  studyFields: StudyFields = emptyStudyFields();
  saving = false;

  constructor(
    private authService: AuthService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.loadState.run(() => this.loadProfile());
  }

  private async loadProfile(): Promise<void> {
    // Asked for rather than read from storage: the copy kept there is only a
    // convenience, and this is the page that edits the real thing.
    const user = await this.authService.fetchMe();
    this.username = user.username;
    this.studyFields = {
      universityCode: user.universityCode ?? null,
      course: user.course ?? null,
      courseKind: user.courseKind ?? null,
    };
  }

  async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;

    const { universityCode, course, courseKind } = this.studyFields;
    const payload: StudyFieldsPayload = {};
    if (universityCode) payload.universityCode = universityCode;
    if (course && courseKind) {
      payload.course = course;
      payload.courseKind = courseKind;
    }

    try {
      await this.authService.updateProfile(payload);
      this.toastService.show(this.transloco.translate('profile.toast.saved'), 'success');
    } catch {
      this.toastService.show(this.transloco.translate('profile.toast.saveError'), 'error');
    } finally {
      this.saving = false;
    }
  }
}
