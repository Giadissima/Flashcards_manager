import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { CommonModule } from '@angular/common';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../flashcard.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { charMinLength, titleMaxLength } from '../../../config/config';

@Component({
  selector: 'app-edit-flashcard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, TiptapEditorDirective],
  templateUrl: './edit-flashcard.html',
  styleUrls: ['./edit-flashcard.scss']
})
export class EditFlashcard implements OnInit, OnDestroy {
  editForm!: FormGroup;
  cardId?: string;

  questionEditor: Editor;
  answerEditor: Editor;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private flashcardService: FlashcardService,
    private toastService: ToastService
  ) {
    this.questionEditor = new Editor({
      extensions: [StarterKit, MathExtension.configure({ evaluation: false })],
    });
    this.answerEditor = new Editor({
      extensions: [StarterKit, MathExtension.configure({ evaluation: false })],
    });
  }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
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

  ngOnDestroy(): void {
    this.questionEditor.destroy();
    this.answerEditor.destroy();
  }

  async loadCardData(id: string): Promise<void> {
    try {
      const card = await this.flashcardService.getById(id);
      this.editForm.patchValue(card);
      this.questionEditor.commands.setContent(card.question);
      this.answerEditor.commands.setContent(card.answer);
    } catch (error) {
      this.toastService.show('Failed to load card data', 'error');
    }
  }

  async updateCard(): Promise<void> {
    if (this.editForm.invalid || !this.cardId) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { _id, title, topic_id } = this.editForm.value;

    const card: Flashcard = {
      _id,
      topic_id: topic_id?._id ?? undefined,
      subject_id: topic_id?.subject_id._id,
      title,
      question: this.questionEditor.getHTML(),
      answer: this.answerEditor.getHTML(),
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
