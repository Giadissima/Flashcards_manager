import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { DurationPipe } from '../../../pipes/duration.pipe';
import { Router, RouterLink } from '@angular/router';
import { Test, TestStats } from '../../models/test.dto';
import { TestService } from '../test.service';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-test-history',
  standalone: true,
  imports: [CommonModule, RouterLink, DurationPipe],
  templateUrl: './test-history.html',
  styleUrl: './test-history.scss',
})
export class TestHistory implements OnInit {
  tests: Test[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  stats: TestStats | null = null;

  constructor(
    private testService: TestService,
    private router: Router,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadTests();
    this.loadStats();
  }

  loadStats(): void {
    this.testService.getStats().then((stats) => (this.stats = stats));
  }

  loadTests(): void {
    this.testService
      .getAll({
        sortField: 'updatedAt',
        sortDirection: 'desc',
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
      })
      .then((data) => {
        this.tests = data.data;
        this.totalCount = data.count;
      });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.loadTests();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.loadTests();
  }

  getCorrectCount(test: Test): number {
    return test.questions.filter((q) => q.is_correct === true).length;
  }

  getWrongCount(test: Test): number {
    return test.questions.filter((q) => q.is_correct === false).length;
  }

  openTest(test: Test): void {
    if (!test._id) return;
    this.router.navigate(['/test-result', test._id]);
  }

  // Riprende un test non concluso (anche da un altro dispositivo, dato che
  // il progresso vive sul server, non nello stato locale del client)
  resumeTest(test: Test): void {
    if (!test._id) return;
    this.router.navigate(['/test', test._id]);
  }

  // Chiude un test non concluso senza rispondere alle domande rimanenti
  // (restano "non date", come se il test fosse stato terminato in anticipo)
  async stopTest(test: Test): Promise<void> {
    if (!test._id) return;
    try {
      await this.testService.update(test._id, { ...test, completedAt: new Date() });
      this.toast.show('Test terminato', 'success');
      this.loadTests();
      this.loadStats();
    } catch (err) {
      console.error('Error stopping test', err);
      this.toast.show('Impossibile terminare il test', 'error');
    }
  }
}
