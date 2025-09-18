// create-card.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { FlashcardService } from '../flashcard.service';
import { Toast } from "../../toast/toast";
import { ToastService } from '../../toast/toast.service';

interface Group {
  _id: string;
  name: string;
}

@Component({
  selector: 'app-create-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './create-flashcard.html',
  styleUrls: ['./create-flashcard.scss']
})
export class CreateFlashcard implements OnInit {
  cardForm!: FormGroup;
  groups: Group[] = [];

  constructor(
    private fb: FormBuilder,
    private flashcardService: FlashcardService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.cardForm = this.fb.group({
      title: ['', Validators.required],
      question: ['', Validators.required],
      answer: ['', Validators.required],
      group: ['']
    });

    this.loadGroups();
  }

  async loadGroups() {
    try {
      // this.groups = await this.flashcardService.getGroups(); TODO
    } catch (err) {
      console.error('Error loading groups', err);
    }
  }

  textAreaAutoResize(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  async addCard() {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }

    const newCard = this.cardForm.value;

    try {
      const result = this.flashcardService.createFlashcard(newCard); // supponendo addCard ritorni la risposta
      this.toastService.show("Card successfully added", 'success')
      this.cardForm.reset();
    } catch (err: any) {
      console.error(err);
      this.toastService.show("Error", 'error')
    }
  }
}
