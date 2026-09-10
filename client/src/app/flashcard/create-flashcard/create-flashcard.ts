import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder,
  FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../shared/searchable-select/searchable-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { answerMaxLength, charMinLength, questionMaxLength, titleMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../shared/modal/modal.component';
import { Router } from '@angular/router';
import { VisibilityToggleComponent } from '../../shared/visibility-toggle/visibility-toggle.component';
import { Visibility } from '../../models/visibility.dto';
import {
  DefaultFlashcardVisibility,
  readDefaultFlashcardVisibility,
  resolveDefaultFlashcardVisibility,
} from '../../shared/default-flashcard-visibility';
import { Editor } from '@tiptap/core';
import { createRichTextEditor } from '../../shared/rich-text-editor/editor.factory';
import { FlashcardService } from '../flashcard.service';
import { PageCardComponent } from '../../shared/page-card/page-card.component';
import { parseFlashcardText } from '../../shared/flashcard-import.util';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Topic } from '../../models/topic.dto';
import { TopicService } from '../../topic/topic.service';
import { TutorialService } from '../../shared/tutorial/tutorial.service';
import { toSubjectOptions, toTopicOptions } from '../../shared/select-options.util';

@Component({
  selector: 'app-create-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RichTextEditorComponent,
    TranslocoModule,
    SearchableSelectComponent,
    PageCardComponent,
    VisibilityToggleComponent,
    ModalComponent,
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

  showImport = false;
  importText = '';

  // Which prerequisite is missing so the user can't create a flashcard yet:
  // no subject at all, or subjects exist but no topic exists in any of them.
  emptyState: 'subjects' | 'topics' | null = null;
  showEmptyStateModal = false;

  // While true, an empty options list is a normal "still fetching" state, not
  // a broken select - see SearchableSelectComponent.isEmpty.
  subjectsLoading = true;
  topicsLoading = true;

  get visibilityControl(): FormControl<Visibility> {
    return this.cardForm.get('visibility') as FormControl<Visibility>;
  }

  /** Read once when the form opens - see create-topic.component.ts for why. */
  private visibilityDefaultMode: DefaultFlashcardVisibility = 'inherit';

  constructor(
    private fb: FormBuilder,
    private flashcardService: FlashcardService,
    private toastService: ToastService,
    private topicService: TopicService,
    private subjectService: SubjectService,
    private transloco: TranslocoService,
    private router: Router,
    private tutorialService: TutorialService
  ) {
    this.questionEditor = createRichTextEditor({
      placeholder: () => this.transloco.translate('flashcard.create.questionPlaceholder'),
      onUpdate: (editor) => this.cardForm.get('question')?.setValue(editor.getText()),
      onBlur: () => this.cardForm.get('question')?.markAsTouched(),
    });
    this.answerEditor = createRichTextEditor({
      placeholder: () => this.transloco.translate('flashcard.create.answerPlaceholder'),
      onUpdate: (editor) => this.cardForm.get('answer')?.setValue(editor.getText()),
      onBlur: () => this.cardForm.get('answer')?.markAsTouched(),
    });
  }

  ngOnInit(): void {
    this.visibilityDefaultMode = readDefaultFlashcardVisibility();
    this.cardForm = this.fb.group({
      visibility: [
        resolveDefaultFlashcardVisibility(this.visibilityDefaultMode, undefined) as Visibility,
      ],
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
      question: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(questionMaxLength)]],
      answer: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(answerMaxLength)]],
      topic_id: ['', Validators.required],
      subject_id: ['']
    });

    Promise.all([this.loadSubjects(), this.loadTopicsBySubject(undefined)]).then(() =>
      this.updateEmptyState()
    );
  }

  // Called after subjects/topics load: no subject at all takes priority over
  // "has subjects but no topic yet", since creating the subject comes first.
  private updateEmptyState(): void {
    if (this.subjects.length === 0) {
      this.emptyState = 'subjects';
    } else if (this.topics.length === 0) {
      this.emptyState = 'topics';
    } else {
      this.emptyState = null;
    }
    this.showEmptyStateModal = this.emptyState !== null;
  }

  closeEmptyStateModal(): void {
    this.showEmptyStateModal = false;
  }

  goToCreatePrerequisite(): void {
    this.showEmptyStateModal = false;
    this.router.navigate([this.emptyState === 'subjects' ? '/create-subject' : '/create-topic']);
  }

  reviewTutorial(): void {
    this.showEmptyStateModal = false;
    this.tutorialService.open();
  }

  ngOnDestroy(): void {
    this.questionEditor.destroy();
    this.answerEditor.destroy();
  }

  async loadTopicsBySubject(subjectId: string | undefined) {
    this.topicsLoading = true;
    try {
      this.topics = await this.topicService.getSelectableTopics(subjectId);
    } catch (err) {
      console.error('Error loading topics for subject ' + subjectId, err);
      this.toastService.show(this.transloco.translate('flashcard.toast.topicsLoadError'), 'error');
    } finally {
      this.topicsLoading = false;
    }
  }

  async loadSubjects() {
    this.subjectsLoading = true;
    try {
      this.subjects = await this.subjectService.getSelectableSubjects();
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show(this.transloco.translate('flashcard.toast.subjectsLoadError'), 'error');
    } finally {
      this.subjectsLoading = false;
    }
  }

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

    get topicOptions(): SelectOption[] {
    return toTopicOptions(this.topics);
  }

  async addCard() {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }

    // Untouched "inherit" is left unset rather than sent as whatever the
    // toggle happened to show before a topic/subject was chosen: the server
    // then resolves it itself - see create-topic.component.ts for the same idea.
    const stillInheriting =
      this.visibilityDefaultMode === 'inherit' && !this.visibilityControl.dirty;
    const newCard = {
      ...this.cardForm.value,
      visibility: stillInheriting ? undefined : this.cardForm.value.visibility,
      question: this.questionEditor.getHTML(),
      answer: this.answerEditor.getHTML()
    };

    try {
      await this.flashcardService.create(newCard);
      this.toastService.show(this.transloco.translate('flashcard.toast.cardAdded'), 'success')

      // Keep subject/topic selected so the next card defaults to the same
      // ones - creating several cards in a row for the same topic is the
      // common case. Only the card-specific fields are cleared.
      const subjectId = this.selectedSubjectId;
      const topicId = this.selectedTopicId;
      this.cardForm.reset();
      this.selectedSubjectId = subjectId;
      this.selectedTopicId = topicId;
      this.cardForm.get('subject_id')?.setValue(subjectId);
      this.cardForm.get('topic_id')?.setValue(topicId);
      this.applyInheritedVisibility();
      this.questionEditor.commands.clearContent();
      this.answerEditor.commands.clearContent();
    } catch (err: any) {
      console.error(err);
      this.toastService.show(this.transloco.translate('flashcard.toast.addError'), 'error')
    }
  }

  toggleImport(): void {
    this.showImport = !this.showImport;
    if (!this.showImport) this.importText = '';
  }

  // Fills the form from the text "copia card" produces, so a card copied from
  // another page can be recreated here instead of retyped by hand.
  applyImport(): void {
    const parsed = parseFlashcardText(this.importText);
    if (!parsed) {
      this.toastService.show(this.transloco.translate('flashcard.create.importParseError'), 'error');
      return;
    }

    this.cardForm.get('title')?.setValue(parsed.title);
    this.questionEditor.commands.setContent(parsed.question);
    this.answerEditor.commands.setContent(parsed.answer);
    this.toastService.show(this.transloco.translate('flashcard.create.importSuccess'), 'success');

    this.showImport = false;
    this.importText = '';
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
    this.applyInheritedVisibility();
  }

  onTopicSelected(id: string | null | undefined): void {
    this.selectedTopicId = id ?? null;
    this.cardForm.get('topic_id')?.setValue(this.selectedTopicId);

    // Automatically picks the subject of the chosen topic, as in setup-test
    const topic = this.topics.find((t) => t._id === this.selectedTopicId);
    const subjectId = (topic?.subject_id as Subject | undefined)?._id;
    if (subjectId && subjectId !== this.selectedSubjectId) {
      this.selectedSubjectId = subjectId;
      this.cardForm.get('subject_id')?.setValue(subjectId);
      this.topics = this.topics.filter(
        (t) => (t.subject_id as Subject)?._id === subjectId,
      );
    }
    this.applyInheritedVisibility();
  }

  /**
   * "Inherit" (the settings default) follows the topic once one is chosen, or
   * the subject failing that - the same priority the server falls back to
   * itself. Left alone once the visitor has touched the toggle themselves.
   */
  private applyInheritedVisibility(): void {
    if (this.visibilityDefaultMode !== 'inherit' || this.visibilityControl.dirty) return;

    const topic = this.topics.find((t) => t._id === this.selectedTopicId);
    const subject = this.subjects.find((s) => s._id === this.selectedSubjectId);
    const parentVisibility = topic?.visibility ?? subject?.visibility;
    this.visibilityControl.setValue(
      resolveDefaultFlashcardVisibility('inherit', parentVisibility),
    );
  }
}
