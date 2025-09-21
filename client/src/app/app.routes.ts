import { CreateFlashcard } from './flashcard/create-flashcard/create-flashcard';
import { EditFlashcard } from './flashcard/edit-flashcard/edit-flashcard';
import { Home } from './home/home';
import { Routes } from '@angular/router';
import { SetupTest } from './test/setup-test/setup-test';
import { TestResult } from './test/test-result/test-result';
import { TestRunner } from './test/test-runner/test-runner';
import { ManageGroupsComponent } from './group/manage-groups.component';
import { CreateGroupComponent } from './group/create-group.component';
import { EditGroupComponent } from './group/edit-group.component';
import { ManageSubjectsComponent } from './subject/manage-subjects.component';
import { CreateSubjectComponent } from './subject/create-subject.component';
import { EditSubjectComponent } from './subject/edit-subject.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'create-card', component: CreateFlashcard },
  { path: 'edit-card/:id', component: EditFlashcard },
  { path: 'setup-test', component: SetupTest },
  { path: 'test-runner', component: TestRunner },
  { path: 'test-result', component: TestResult },
  { path: 'manage-groups', component: ManageGroupsComponent },
  { path: 'create-group', component: CreateGroupComponent },
  { path: 'edit-group/:id', component: EditGroupComponent },
  { path: 'manage-subjects', component: ManageSubjectsComponent },
  { path: 'create-subject', component: CreateSubjectComponent },
  { path: 'edit-subject/:id', component: EditSubjectComponent },
];
