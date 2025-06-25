import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestRunner } from './test-runner';

describe('TestRunner', () => {
  let component: TestRunner;
  let fixture: ComponentFixture<TestRunner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestRunner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestRunner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
