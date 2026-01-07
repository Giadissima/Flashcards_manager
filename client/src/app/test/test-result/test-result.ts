import { ActivatedRoute } from '@angular/router';
import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DurationExtendedFormatPipe } from '../../../pipes/duration.extended.pipe';
import { Test } from '../../models/test.dto';
import { TestService } from '../test.service';

@Component({
  selector: 'app-test-result',
  imports: [DatePipe, DurationExtendedFormatPipe],
  templateUrl: './test-result.html',
  styleUrl: './test-result.scss'
})
export class TestResult {
  testId!: string;
  test!: Test;
  stats = { correct: 0, wrong: 0, blank: 0 };
  elapsed_time = 0;
  createdAt?: Date;
  completedAt?: Date;

  constructor(
    private route: ActivatedRoute,
    private testService: TestService,
  ){}

  ngOnInit(): void {
      this.route.paramMap.subscribe(params => {
        const id = params.get('test_id');
        if(id){
          this.testId = id;
          this.viewTest();
        }else {
          alert("non è stato possibile prendere il test");
        }
      });
    }

  async viewTest() {
    //get test
    if(!this.testId) return;
    this.test = await this.testService.getById(this.testId);
    if(!this.test) alert("error getting test");

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
  }


}
