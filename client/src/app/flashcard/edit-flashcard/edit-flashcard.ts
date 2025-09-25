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
    topic_id: ['']
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

    const { _id, title, question, answer } = this.editForm.value;

    const card: Flashcard = {
      _id,
      topic_id: this.editForm.value.topic_id?._id ?? undefined,     // gestisce sia oggetto che stringa
      subject_id: this.editForm.value.topic_id.subject_id._id, // TODO se non esiste il topic ma esiste la materia dà errore per come risulta l'oggetto, perché subject è dentro topic
      title,
      question,
      answer,
    };
    
    try {
      await this.flashcardService.update(this.cardId, card);
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
