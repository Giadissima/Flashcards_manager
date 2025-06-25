import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetupTest } from './setup-test';

describe('SetupTest', () => {
  let component: SetupTest;
  let fixture: ComponentFixture<SetupTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetupTest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
