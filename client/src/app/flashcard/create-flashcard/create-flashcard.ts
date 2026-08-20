import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../shared/searchable-select/searchable-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { answerMaxLength, charMinLength, questionMaxLength, titleMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { FlashcardService } from '../flashcard.service';
import Image from '@tiptap/extension-image';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import Placeholder from '@tiptap/extension-placeholder';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';
import StarterKit from '@tiptap/starter-kit';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from "../../toast/toast";
import { ToastService } from '../../toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { getSubjectIconUrl } from '../../subject/subject-icon.util';

@Component({
  selector: 'app-create-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Toast,
    RichTextEditorComponent,
    TranslocoModule,
    SearchableSelectComponent
  ],
  templateUrl: './create-flashcard.html',
})
export class CreateFlashcard implements OnInit, OnDestroy {
  cardForm!: FormGroup;
  topics: Topic[] = [];
  subjects: Subject[] = [];
  selectedSubjectId: string | null = null;
  selectedTopicId: string | null = null;

  questionEditor: Editor;
  answerEditor: Editor;

  constructor(
    private fb: FormBuilder,
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
        this.cardForm.get('question')?.setValue(editor.getText());
      },
      onBlur: () => {
        this.cardForm.get('question')?.markAsTouched();
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
        this.cardForm.get('answer')?.setValue(editor.getText());
      },
      onBlur: () => {
        this.cardForm.get('answer')?.markAsTouched();
      },
    });
  }

  ngOnInit(): void {
    this.cardForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
      question: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(questionMaxLength)]],
      answer: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(answerMaxLength)]],
      topic_id: ['', Validators.required],
      subject_id: ['']
    });

    this.loadSubjects();
    this.loadTopicsBySubject(undefined);
  }

  ngOnDestroy(): void {
    this.questionEditor.destroy();
    this.answerEditor.destroy();
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
      this.selectedSubjectId = null;
      this.selectedTopicId = null;
      this.topics = [];
      this.loadTopicsBySubject(undefined);
      this.questionEditor.commands.clearContent();
      this.answerEditor.commands.clearContent();
    } catch (err: any) {
      console.error(err);
      this.toastService.show(this.transloco.translate('flashcard.toast.addError'), 'error')
    }
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id ?? null;
    this.cardForm.get('subject_id')?.setValue(this.selectedSubjectId);
    this.topics = [];
    this.loadTopicsBySubject(this.selectedSubjectId ?? undefined);

    if (
      this.selectedTopicId &&
      !this.topics.some((t) => t._id === this.selectedTopicId)
    ) {
      this.selectedTopicId = null;
      this.cardForm.get('topic_id')?.setValue(null);
    }
  }

  onTopicSelected(id: string | null | undefined): void {
    this.selectedTopicId = id ?? null;
    this.cardForm.get('topic_id')?.setValue(this.selectedTopicId);

    // Seleziona in automatico la materia dell'argomento scelto, come in setup-test
    const topic = this.topics.find((t) => t._id === this.selectedTopicId);
    const subjectId = (topic?.subject_id as Subject | undefined)?._id;
    if (subjectId && subjectId !== this.selectedSubjectId) {
      this.selectedSubjectId = subjectId;
      this.cardForm.get('subject_id')?.setValue(subjectId);
      this.topics = this.topics.filter(
        (t) => (t.subject_id as Subject)?._id === subjectId,
      );
    }
  }
}
