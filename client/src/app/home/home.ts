import { Component, OnInit } from '@angular/core';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../models/flashcard.dto';
import { FlashcardService } from '../flashcard/flashcard.service';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { KatexRendererPipe } from '../pipes/katex-renderer.pipe';
import { Router } from '@angular/router';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';
import { Topic } from '../models/topic.dto';
import { TopicService } from '../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getSubjectIconUrl } from '../subject/subject-icon.util';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Toast, FormsModule, KatexRendererPipe, SearchableSelectComponent, TranslocoModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  flashcards: Flashcard[] = [];
  subjects: Subject[] = [];
  topics: Topic[] = [];
  selectedSubjectId: string | null | undefined = null;
  selectedTopicId: string | null | undefined = null;
  searchTerm: string = '';
  sortBy: 'title' | 'createdAt' = 'title';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Paginazione
  currentPage = 1;
  pageSize = 21;
  totalCount = 0;

  // mappa _id -> boolean (true = mostra risposta)
  showAnswerMap: Record<string, boolean> = {};

  get subjectOptions(): SelectOption[] {
    return this.subjects.map((s) => ({ value: s._id!, label: s.name, iconUrl: getSubjectIconUrl(s) }));
  }

  get topicOptions(): SelectOption[] {
    return this.topics.map((t) => ({ value: t._id!, label: t.name, color: t.color }));
  }

  constructor(
    private flashcardsService: FlashcardService,
    private toast: ToastService,
    private router: Router,
    private subjectService: SubjectService,
    private topicService: TopicService,
    private transloco: TranslocoService,
  ) {}
  // TODO mettere dei valori di default, non deve essere obbligatorio il filter né mettere tutti i parametri dentro filter
  ngOnInit(): void {
    this.subjectService
      .getAllSubjects({
        sortField: 'name',
        sortDirection: 'asc',
        skip: 0,
        limit: 50,
      })
      .then((data) => (this.subjects = data.data));

    this.topicService
      .getAllTopics({
        sortField: 'name',
        sortDirection: 'asc',
        skip: 0,
        limit: 50,
      })
      .then((data) => (this.topics = data.data));
    this.loadFlashcards();
  }

  loadFlashcards(): void {
    this.flashcardsService
      .getAll({
        sortField: this.sortBy,
        sortDirection: this.sortDirection,
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        subject_id: this.selectedSubjectId || undefined,
        topic_id: this.selectedTopicId || undefined,
        title: this.searchTerm || undefined,
      })
      .then((data) => {
        this.flashcards = data.data;
        this.totalCount = data.count;
      });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.loadFlashcards();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.loadFlashcards();
  }

  onFilterChange(): void {
    if (this.selectedSubjectId == null) {
      this.loadTopicsBySubject(undefined);
    } else if (this.selectedSubjectId) {
      this.loadTopicsBySubject(this.selectedSubjectId);
    } else {
      this.topics = [];
    }
    this.currentPage = 1;
    this.loadFlashcards();
  }

  onSearchTermChange(): void {
    this.currentPage = 1;
    this.loadFlashcards();
  }

  setSortBy(field: 'title' | 'createdAt'): void {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadFlashcards();
  }

  getCardColor(card: Flashcard): string {
    // se topic_id è un oggetto Topic, usa il suo colore
    if (
      card.topic_id &&
      typeof card.topic_id !== 'string' &&
      card.topic_id.color
    ) {
      return card.topic_id.color;
    }
    // fallback
    return 'blue';
  }

  getCardSubjectIconUrl(card: Flashcard): string {
    // subject_id è quasi sempre popolato direttamente sulla flashcard (sia da
    // create-flashcard che dall'import), ma in caso contrario si risolve
    // comunque tramite la lista già caricata per il filtro
    let subject: Subject | undefined;
    if (card.subject_id && typeof card.subject_id !== 'string') {
      subject = card.subject_id;
    } else if (typeof card.subject_id === 'string') {
      subject = this.subjects.find((s) => s._id === card.subject_id);
    }
    return getSubjectIconUrl(subject);
  }

  getCardBody(card: Flashcard): string {
    if (!card._id) return card.question;
    return (
      '<p>' +
      (this.showAnswerMap[card._id] ? card.answer : card.question) +
      '</p>'
    );
  }

  // cambia da 'Vedi risposta' a 'Vedi domanda'
  getCardButtonText(card: Flashcard): string {
    return this.transloco.translate(this.showAnswerMap[card._id] ? 'home.seeQuestion' : 'home.seeAnswer');
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  async deleteCard(card: Flashcard): Promise<void> {
    if (!card._id) return;
    try {
      await this.flashcardsService.delete(card._id);
      this.toast.show(this.transloco.translate('home.toast.cardDeleted'), 'success');
      this.flashcards = this.flashcards.filter((c) => c._id !== card._id);
    } catch (error: any) {
      this.toast.show(this.transloco.translate('home.toast.deleteError'), 'error');
    }
  }

  async loadTopicsBySubject(subjectId: string | undefined) {
    try {
      const response = await this.topicService.getAllTopics({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc',
        subject_id: subjectId,
      });
      this.topics = response.data;
    } catch (err) {
      console.error('Error loading topics for subject ' + subjectId, err);
      this.toast.show(
        this.transloco.translate('home.toast.topicsLoadError'),
        'error',
      );
    }
  }

  modifyCard(card: Flashcard): void {
    if (card._id) {
      this.router.navigate(['/edit-card', card._id]);
    }
  }

  copyCard(card: Flashcard): void {
    // 1. Prepariamo la stringa da copiare
    const textToCopy = `${card.title}\nQuestion: ${card.question}\nAnswer: ${card.answer}`;

    // 2. Proviamo la via moderna (Clipboard API)
    // Controlliamo se esiste l'oggetto e se siamo in un contesto sicuro (HTTPS/Localhost)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          this.toast.show(this.transloco.translate('home.toast.cardCopied'), 'success');
        })
        .catch((err) => {
          // Se per qualche motivo l'API moderna fallisce, proviamo il fallback
          this.executeFallbackCopy(textToCopy);
        });
    } else {
      // 3. Se l'API moderna non esiste (es. rete privata HTTP), usiamo il fallback
      this.executeFallbackCopy(textToCopy);
    }
  }

  private executeFallbackCopy(text: string): void {
    // Creiamo un elemento "invisibile" per contenere il testo
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Lo posizioniamo fuori dallo schermo per non disturbare l'utente
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);

    // Selezioniamo il contenuto
    textArea.focus();
    textArea.select();

    try {
      // Il vecchio comando in caso di url con http
      const successful = document.execCommand('copy');
      if (successful) {
        this.toast.show(this.transloco.translate('home.toast.cardCopied'), 'success');
      } else {
        console.error('ERR: Il comando copy ha restituito false');
        this.toast.show(this.transloco.translate('home.toast.copyError'), 'error');
      }
    } catch (err) {
      console.error('ERR: Errore durante il fallback di copia:', err);
      this.toast.show(this.transloco.translate('home.toast.copyError'), 'error');
    }

    // Pulizia: rimuoviamo l'elemento creato
    document.body.removeChild(textArea);
  }

  onSubjectSelected(id: string | null | undefined): void {
    this.selectedSubjectId = id;
    this.onFilterChange();
  }

  onTopicSelected(id: string | null | undefined): void {
    this.selectedTopicId = id;
    this.onFilterChange();
  }
}
