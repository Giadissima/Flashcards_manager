import { CreateFlashcard } from './flashcard/create-flashcard/create-flashcard';
import { CreateGroupComponent } from './group/create-group/create-group.component';
import { CreateSubjectComponent } from './subject/create-subject/create-subject.component';
import { EditFlashcard } from './flashcard/edit-flashcard/edit-flashcard';
import { EditGroupComponent } from './group/edit-group/edit-group.component';
import { EditSubjectComponent } from './subject/edit-subject/edit-subject.component';
import { Home } from './home/home';
import { ManageGroupsComponent } from './group/manage-groups/manage-groups.component';
import { ManageSubjectsComponent } from './subject/manage-subjects/manage-subjects.component';
import { Routes } from '@angular/router';
import { SetupTest } from './test/setup-test/setup-test';
import { TestResult } from './test/test-result/test-result';
import { TestRunner } from './test/test-runner/test-runner';

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
