import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { answerMaxLength, charMinLength, questionMaxLength, titleMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../flashcard.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-edit-flashcard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './edit-flashcard.html',
  styleUrls: ['./edit-flashcard.scss']
})
export class EditFlashcard implements OnInit {
  editForm!: FormGroup;
  cardId?: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private flashcardService: FlashcardService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
  this.editForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
    question: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(questionMaxLength)]],
    answer: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(answerMaxLength)]],
    group_id: ['']
  });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cardId = id;
        this.loadCardData(id);
      }
    });
  }

  async loadCardData(id: string): Promise<void> {
    try {
      const card = await this.flashcardService.getById(id);
      this.editForm.patchValue(card);
    } catch (error) {
      this.toastService.show('Failed to load card data', 'error');
    }
  }

  async updateCard(): Promise<void> {
    if (this.editForm.invalid || !this.cardId) {
      this.editForm.markAllAsTouched();
      return;
    }

    try {
      await this.flashcardService.update(this.cardId, this.editForm.value);
      this.toastService.show('Card updated successfully', 'success');
      this.router.navigate(['/home']);
    } catch (error) {
      this.toastService.show('Failed to update card', 'error');
    }
  }

  textAreaAutoResize(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
}
