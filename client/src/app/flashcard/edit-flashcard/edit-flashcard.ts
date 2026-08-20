import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { answerMaxLength, charMinLength, questionMaxLength, titleMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Flashcard } from '../../models/flashcard.dto';
import { FlashcardService } from '../flashcard.service';
import { LoadStateComponent } from '../../shared/load-state/load-state.component';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import Placeholder from '@tiptap/extension-placeholder';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';
import StarterKit from '@tiptap/starter-kit';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from '../../toast/toast';
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { getSubjectIconUrl } from '../../subject/subject-icon.util';

@Component({
  selector: 'app-edit-flashcard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, RichTextEditorComponent, TranslocoModule, SearchableSelectComponent, LoadStateComponent],
  templateUrl: './edit-flashcard.html',
})
export class EditFlashcard implements OnInit, OnDestroy {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  editForm!: FormGroup;
  cardId?: string;

  topics: Topic[] = [];
  subjects: Subject[] = [];

  get subjectOptions(): SelectOption[] {
    return this.subjects.map((s) => ({
      value: s._id!,
      label: s.name,
      iconUrl: getSubjectIconUrl(s),
    }));
  }

  get topicOptions(): SelectOption[] {
    return this.topics.map((t) => ({
      value: t._id!,
      label: t.name,
      color: t.color,
    }));
  }

  questionEditor: Editor;
  answerEditor: Editor;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private flashcardService: FlashcardService,
    private toastService: ToastService,
    private topicService: TopicService,
    private subjectService: SubjectService,
    private transloco: TranslocoService
  ) {
    this.questionEditor = new Editor({
      extensions: [
        StarterKit,
        MathExtension.configure({ evaluation: false }),
        Image.configure({ inline: false }),
        Placeholder.configure({
          placeholder: ({ editor }) =>
            editor.isEmpty ? this.transloco.translate('flashcard.create.questionPlaceholder') : '',
        }),
      ],
      onUpdate: ({ editor }) => {
        this.editForm.get('question')?.setValue(editor.getText());
      },
      onBlur: () => {
        this.editForm.get('question')?.markAsTouched();
      },
    });
    this.answerEditor = new Editor({
      extensions: [
        StarterKit,
        MathExtension.configure({ evaluation: false }),
        Image.configure({ inline: false }),
        Placeholder.configure({
          placeholder: ({ editor }) =>
            editor.isEmpty ? this.transloco.translate('flashcard.create.answerPlaceholder') : '',
        }),
      ],
      onUpdate: ({ editor }) => {
        this.editForm.get('answer')?.setValue(editor.getText());
      },
      onBlur: () => {
        this.editForm.get('answer')?.markAsTouched();
      },
    });
  }

  ngOnInit(): void {
    this.editForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
      question: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(questionMaxLength)]],
      answer: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(answerMaxLength)]],
      subject_id: ['', Validators.required],
      topic_id: ['', Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cardId = id;
        this.loadState.run(() => this.loadCardData(id));
      } else {
        this.router.navigate(['/not-found']);
      }
    });

    this.loadSubjects();
    this.loadTopicsBySubject(undefined);

    this.editForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      this.topics = [];
      this.editForm.get('topic_id')?.reset('');
      this.loadTopicsBySubject(subjectId);
    });
  }

  ngOnDestroy(): void {
    this.questionEditor.destroy();
    this.answerEditor.destroy();
  }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  async loadCardData(id: string): Promise<void> {
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
    this.editForm.get('question')?.setValue(this.questionEditor.getText());
    this.editForm.get('answer')?.setValue(this.answerEditor.getText());
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

  async loadTopicsBySubject(subjectId: string | undefined) {
    try {
      const response = await this.topicService.getAllTopics({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc',
        subject_id: subjectId
      });
      this.topics = response.data;
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
