import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteFlashcard } from './delete-flashcard';

describe('DeleteFlashcard', () => {
  let component: DeleteFlashcard;
  let fixture: ComponentFixture<DeleteFlashcard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteFlashcard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteFlashcard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
