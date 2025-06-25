import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditFlashcard } from './edit-flashcard';

describe('EditFlashcard', () => {
  let component: EditFlashcard;
  let fixture: ComponentFixture<EditFlashcard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditFlashcard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditFlashcard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
