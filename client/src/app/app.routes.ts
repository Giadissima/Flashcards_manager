import { authGuard, guestGuard } from './auth/auth.guard';

import { AdminComponent } from './admin/admin.component';

import { CommunityComponent } from './community/community.component';
import { CreateFlashcard } from './flashcard/create-flashcard/create-flashcard';
import { CreateSubjectComponent } from './subject/create-subject/create-subject.component';
import { CreateTopicComponent } from './topic/create-topic/create-topic.component';
import { EditFlashcard } from './flashcard/edit-flashcard/edit-flashcard';
import { EditSubjectComponent } from './subject/edit-subject/edit-subject.component';
import { EditTopicComponent } from './topic/edit-topic/edit-topic.component';
import { Home } from './home/home';
import { LandingComponent } from './landing/landing.component';
import { LoginComponent } from './auth/login/login.component';
import { ManageSubjectsComponent } from './subject/manage-subjects/manage-subjects.component';
import { ManageTopicsComponent } from './topic/manage-topics/manage-topics.component';
import { NotFoundComponent } from './shared/not-found/not-found.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { ProfileComponent } from './profile/profile.component';
import { RegisterComponent } from './auth/register/register.component';
import { Routes } from '@angular/router';
import { SetupTest } from './test/setup-test/setup-test';
import { VerifyEmailComponent } from './auth/verify-email/verify-email.component';
import { TestHistory } from './test/test-history/test-history';
import { TestResult } from './test/test-result/test-result';
import { TestRunner } from './test/test-runner/test-runner';

export const routes: Routes = [
  // The one page open to search engines and to anybody without an account:
  // guestGuard sends an already-logged-in visitor straight to /home instead,
  // the same way it already does for /login and /register below.
  { path: '', pathMatch: 'full', component: LandingComponent, canActivate: [guestGuard] },
  // Outside the app's own login, and with no link pointing at it: this one is
  // opened from the address in the chat, with the server's own password.
  { path: 'admin', component: AdminComponent },
  { path: 'admin/:id', component: AdminComponent },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  // No guard of any kind: the link is opened from a mail, so the reader can be
  // logged in, logged out, or in a browser that has never seen this site.
  { path: 'verify-email', component: VerifyEmailComponent },
  // Linked from the landing page footer, and open to anyone, logged in or not.
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  // Every page of the app hangs off this one, so a new route is behind the
  // login by default instead of having to remember its own guard.
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: 'home', component: Home },
      { path: 'community', component: CommunityComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'create-card', component: CreateFlashcard },
      { path: 'edit-card/:id', component: EditFlashcard },
      { path: 'setup-test', component: SetupTest },
      { path: 'test/:test_id', component: TestRunner },
      { path: 'test-result', component: TestHistory },
      { path: 'test-result/:test_id', component: TestResult },
      { path: 'manage-topics', component: ManageTopicsComponent },
      { path: 'create-topic', component: CreateTopicComponent },
      { path: 'edit-topic/:id', component: EditTopicComponent },
      { path: 'manage-subjects', component: ManageSubjectsComponent },
      { path: 'create-subject', component: CreateSubjectComponent },
      { path: 'edit-subject/:id', component: EditSubjectComponent },
      { path: 'not-found', component: NotFoundComponent },
      { path: '**', component: NotFoundComponent },
    ],
  },
];
