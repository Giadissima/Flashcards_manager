import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { charMinLength, titleMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../flashcard.service';
import { FileService } from '../../shared/file/file.service';
import { getFileUrl } from '../../shared/file/file-url.util';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import StarterKit from '@tiptap/starter-kit';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

const maxImageSize = 5 * 1024 * 1024;

@Component({
  selector: 'app-edit-flashcard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, TiptapEditorDirective, TranslocoModule],
  templateUrl: './edit-flashcard.html',
  styleUrls: ['./edit-flashcard.scss']
})
export class EditFlashcard implements OnInit, OnDestroy {
  editForm!: FormGroup;
  cardId?: string;

  topics: Topic[] = [];
  subjects: Subject[] = [];

  questionEditor: Editor;
  answerEditor: Editor;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private flashcardService: FlashcardService,
    private fileService: FileService,
    private toastService: ToastService,
    private topicService: TopicService,
    private subjectService: SubjectService,
    private transloco: TranslocoService
  ) {
    this.questionEditor = new Editor({
      extensions: [StarterKit, MathExtension.configure({ evaluation: false }), Image.configure({ inline: false })],
    });
    this.answerEditor = new Editor({
      extensions: [StarterKit, MathExtension.configure({ evaluation: false }), Image.configure({ inline: false })],
    });
  }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
      subject_id: ['', Validators.required],
      topic_id: [{ value: '', disabled: true }, Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cardId = id;
        this.loadCardData(id);
      }
    });

    this.loadSubjects();

    this.editForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      this.topics = [];
      this.editForm.get('topic_id')?.reset({ value: '', disabled: !subjectId });
      
      if (subjectId) {
        this.loadTopicsBySubject(subjectId);
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

      if (this.subjects.length === 0) {
        await this.loadSubjects();
      }

      // Estraiamo gli ID stringa (potrebbero essere oggetti se popolati dal backend)
      const subjectId = typeof card.subject_id === 'object' ? (card.subject_id as any)?._id : card.subject_id;
      const topicId = typeof card.topic_id === 'object' ? (card.topic_id as any)?._id : card.topic_id;

      if (subjectId) {
        await this.loadTopicsBySubject(subjectId);
      }

      this.editForm.patchValue({
        title: card.title,
        subject_id: subjectId,
        topic_id: topicId
      });

      this.questionEditor.commands.setContent(card.question);
      this.answerEditor.commands.setContent(card.answer);

    } catch (error) {
      console.error('Error loading card data', error);
      this.toastService.show(this.transloco.translate('flashcard.toast.loadError'), 'error');
    }
  }

  async updateCard(): Promise<void> {
    if (this.editForm.invalid || !this.cardId) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { title, topic_id, subject_id } = this.editForm.value;

    const card: Omit<Flashcard, '_id'> = {
      topic_id,
      subject_id,
      title,
      question: this.questionEditor.getHTML(),
      answer: this.answerEditor.getHTML(),
    };
    
    try {
      await this.flashcardService.update(this.cardId, card);
      this.toastService.show(this.transloco.translate('flashcard.toast.cardUpdated'), 'success');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error updating card', error);
      this.toastService.show(this.transloco.translate('flashcard.toast.updateError'), 'error');
    }
  }

  textAreaAutoResize(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  async onImageSelected(event: Event, editor: Editor): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toastService.show(this.transloco.translate('flashcard.toast.invalidImageType'), 'error');
      input.value = '';
      return;
    }
    if (file.size > maxImageSize) {
      this.toastService.show(this.transloco.translate('flashcard.toast.imageTooLarge'), 'error');
      input.value = '';
      return;
    }

    try {
      const { _id } = await this.fileService.upload(file);
      editor.chain().focus().setImage({ src: getFileUrl(_id) }).run();
    } catch (err) {
      console.error('Error uploading image', err);
      this.toastService.show(this.transloco.translate('flashcard.toast.imageUploadError'), 'error');
    } finally {
      input.value = '';
    }
  }

  async loadTopicsBySubject(subjectId: string) {
    try {
      const response = await this.topicService.getAllTopics({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc',
        subject_id: subjectId
      });
      this.topics = response.data;
      this.editForm.get('topic_id')?.enable();
    } catch (err) {
      console.error('Error loading topics for subject ' + subjectId, err);
      this.toastService.show(this.transloco.translate('flashcard.toast.topicsLoadError'), 'error');
    }
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc'
      });
      this.subjects = response.data;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(this.transloco.translate('flashcard.toast.subjectsLoadError'), 'error');
    }
  }
}
