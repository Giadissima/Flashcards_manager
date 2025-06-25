import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateFlashcard } from './create-flashcard';

describe('CreateFlashcard', () => {
  let component: CreateFlashcard;
  let fixture: ComponentFixture<CreateFlashcard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateFlashcard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateFlashcard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
