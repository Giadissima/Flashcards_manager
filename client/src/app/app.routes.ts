import { CreateFlashcard } from './flashcard/create-flashcard/create-flashcard';
import { DeleteFlashcard } from './flashcard/delete-flashcard/delete-flashcard';
import { EditFlashcard } from './flashcard/edit-flashcard/edit-flashcard';
import { Home } from './home/home';
import { Routes } from '@angular/router';
import { SetupTest } from './test/setup-test/setup-test';
import { TestResult } from './test/test-result/test-result';
import { TestRunner } from './test/test-runner/test-runner';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'create-card', component: CreateFlashcard },
  { path: 'edit-card', component: EditFlashcard },
  { path: 'delete-card', component: DeleteFlashcard },
  { path: 'setup-test', component: SetupTest },
  { path: 'test-runner', component: TestRunner },
  { path: 'test-result', component: TestResult },
];
