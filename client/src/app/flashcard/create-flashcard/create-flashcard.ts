import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { CommonModule } from '@angular/common';
import { FlashcardService } from '../flashcard.service';
import { FileService } from '../../shared/file/file.service';
import { getFileUrl } from '../../shared/file/file-url.util';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from "../../toast/toast";
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { charMinLength, titleMaxLength } from '../../../config/config';

const maxImageSize = 5 * 1024 * 1024;

@Component({
  selector: 'app-create-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Toast,
    TiptapEditorDirective,
    TranslocoModule
  ],
  templateUrl: './create-flashcard.html',
  styleUrls: ['./create-flashcard.scss']
})
export class CreateFlashcard implements OnInit, OnDestroy {
  cardForm!: FormGroup;
  topics: Topic[] = [];
  subjects: Subject[] = [];

  questionEditor: Editor;
  answerEditor: Editor;

  constructor(
    private fb: FormBuilder,
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
    this.cardForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
      topic_id: [{ value: '', disabled: true }],
      subject_id: ['']
    });

    this.loadSubjects();

    this.cardForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      this.topics = [];
      this.cardForm.get('topic_id')?.reset({ value: '', disabled: !subjectId });
      
      if (subjectId) {
        this.loadTopicsBySubject(subjectId);
      }
    });
  }

  ngOnDestroy(): void {
    this.questionEditor.destroy();
    this.answerEditor.destroy();
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
      this.cardForm.get('topic_id')?.enable();
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

  async addCard() {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }

    const newCard = {
      ...this.cardForm.value,
      question: this.questionEditor.getHTML(),
      answer: this.answerEditor.getHTML()
    };

    try {
      await this.flashcardService.create(newCard);
      this.toastService.show(this.transloco.translate('flashcard.toast.cardAdded'), 'success')
      this.cardForm.reset();
      this.questionEditor.commands.clearContent();
      this.answerEditor.commands.clearContent();
    } catch (err: any) {
      console.error(err);
      this.toastService.show(this.transloco.translate('flashcard.toast.addError'), 'error')
    }
  }
}
