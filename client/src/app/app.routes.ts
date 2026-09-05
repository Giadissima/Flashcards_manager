import { authGuard, guestGuard } from './auth/auth.guard';

import { CreateFlashcard } from './flashcard/create-flashcard/create-flashcard';
import { CreateSubjectComponent } from './subject/create-subject/create-subject.component';
import { CreateTopicComponent } from './topic/create-topic/create-topic.component';
import { EditFlashcard } from './flashcard/edit-flashcard/edit-flashcard';
import { EditSubjectComponent } from './subject/edit-subject/edit-subject.component';
import { EditTopicComponent } from './topic/edit-topic/edit-topic.component';
import { Home } from './home/home';
import { LoginComponent } from './auth/login/login.component';
import { ManageSubjectsComponent } from './subject/manage-subjects/manage-subjects.component';
import { ManageTopicsComponent } from './topic/manage-topics/manage-topics.component';
import { NotFoundComponent } from './shared/not-found/not-found.component';
import { RegisterComponent } from './auth/register/register.component';
import { Routes } from '@angular/router';
import { SetupTest } from './test/setup-test/setup-test';
import { TestHistory } from './test/test-history/test-history';
import { TestResult } from './test/test-result/test-result';
import { TestRunner } from './test/test-runner/test-runner';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  // Every page of the app hangs off this one, so a new route is behind the
  // login by default instead of having to remember its own guard.
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: Home },
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
