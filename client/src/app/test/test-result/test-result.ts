import { CommonModule, NgClass } from '@angular/common';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Component, ViewChild } from '@angular/core';
import { DurationLongPipe } from '../../pipes/duration-long.pipe';
import { FlashcardService } from '../../flashcard/flashcard.service';
import { KatexRendererPipe } from '../../pipes/katex-renderer.pipe';
import { ImageLightboxComponent } from '../../shared/image-lightbox/image-lightbox.component';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { ZoomableImagesDirective } from '../../shared/zoomable-images.directive';
import { Test } from '../../models/test.dto';
import { TestService } from '../test.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-test-result',
  standalone: true,
  imports: [CommonModule, DurationLongPipe, NgClass, KatexRendererPipe, RouterLink, TranslocoModule, LoadStateComponent, ImageLightboxComponent, ZoomableImagesDirective],
  templateUrl: './test-result.html',
  styleUrl: './test-result.scss'
})
export class TestResult {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  testId!: string;
  test!: Test;
  stats = { correct: 0, wrong: 0, blank: 0 };
  elapsed_time = 0;
  createdAt?: Date;
  completedAt?: Date;
  showOnlyWrong = false;
  questions: {
        id: string,
        title: string,
        is_correct: string,
        question: string,
        answer: string
      }[] = [];;

  constructor(
    private route: ActivatedRoute,
    private testService: TestService,
    private flashcardService: FlashcardService,
    private transloco: TranslocoService,
    private router: Router
  ){}

  ngOnInit(): void {
      this.route.paramMap.subscribe(params => {
        const id = params.get('test_id');
        if(id){
          this.testId = id;
          this.loadState.run(() => this.viewTest());
        }else {
          this.router.navigate(['/not-found'], { queryParams: { message: 'common.error.testNotFound' } });
        }
      });
    }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async viewTest(): Promise<void> {
    this.test = await this.testService.getById(this.testId);

    // setup html variables
    this.stats = this.test.questions.reduce(
      (acc, q) => {
        if (q.is_correct === true) acc.correct++;
        else if (q.is_correct === false) acc.wrong++;
        else acc.blank++;
        return acc;
      },
      { correct: 0, wrong: 0, blank: 0 }
    );
    this.elapsed_time = this.test.elapsed_time ?? 0;
    this.completedAt = this.test.completedAt;
    this.createdAt = this.test.createdAt;

    // load questions' array
    await this.loadQuestions();
  }

  async loadQuestions() {
  if (!this.test || !this.test.questions) return;

  this.questions = await Promise.all(
    this.test.questions.map(async (q) => {
      const flashcard = await this.flashcardService.getById(q.flashcard_id);
      let res;
      if(q.is_correct === true) res = 'true';
      else if(q.is_correct === false) res = 'false';
      else res = 'blank';
      return {
        id: flashcard?._id,
        title: flashcard?.title ?? this.transloco.translate('test.result.titleNotAvailable'),
        is_correct: res,
        question: flashcard?.question ?? this.transloco.translate('test.result.questionNotAvailable'),
        answer: flashcard?.answer ?? this.transloco.translate('test.result.answerNotAvailable')

      };
    })
  );
}

  get filteredQuestions() {
    return this.showOnlyWrong
      ? this.questions.filter((q) => q.is_correct === 'false')
      : this.questions;
  }

  toggleShowOnlyWrong(): void {
    this.showOnlyWrong = !this.showOnlyWrong;
  }
}
