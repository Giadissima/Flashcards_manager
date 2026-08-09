import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../models/flashcard.dto';
import { FlashcardService } from '../flashcard/flashcard.service';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { KatexRendererPipe } from '../pipes/katex-renderer.pipe';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';
import { Topic } from '../models/topic.dto';
import { TopicService } from '../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getSubjectIconUrl } from '../subject/subject-icon.util';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Toast, FormsModule, KatexRendererPipe, SearchableSelectComponent, TranslocoModule, ModalComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('imageModalImg') imageModalImgRef?: ElementRef<HTMLImageElement>;

  flashcards: Flashcard[] = [];
  isImageModalOpen = false;
  selectedImageUrl: string | null = null;
  private panzoomInstance: PanzoomObject | null = null;
  private imageZoomNeedsInit = false;
  private readonly onImageWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.panzoomInstance?.zoomWithWheel(event);
  };
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
    private activatedRoute: ActivatedRoute,
    private subjectService: SubjectService,
    private topicService: TopicService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    const qp = this.activatedRoute.snapshot.queryParamMap;
    this.selectedSubjectId = qp.get('subject_id') || null;
    this.selectedTopicId = qp.get('topic_id') || null;
    this.searchTerm = qp.get('search') || '';
    this.sortBy = (qp.get('sortBy') as 'title' | 'createdAt') || 'title';
    this.sortDirection = (qp.get('sortDirection') as 'asc' | 'desc') || 'asc';
    this.currentPage = Number(qp.get('page')) || 1;

    this.subjectService
      .getAllSubjects({
        sortField: 'name',
        sortDirection: 'asc',
        skip: 0,
        limit: 50,
      })
      .then((data) => (this.subjects = data.data));

    this.loadTopicsBySubject(this.selectedSubjectId || undefined);
    this.loadFlashcards();
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        subject_id: this.selectedSubjectId || null,
        topic_id: this.selectedTopicId || null,
        search: this.searchTerm || null,
        sortBy: this.sortBy,
        sortDirection: this.sortDirection,
        page: this.currentPage,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
    this.updateQueryParams();
    this.loadFlashcards();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.updateQueryParams();
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
    this.updateQueryParams();
    this.loadFlashcards();
  }

  onSearchTermChange(): void {
    this.currentPage = 1;
    this.updateQueryParams();
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
    this.updateQueryParams();
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

  getCardSubjectName(card: Flashcard): string {
    if (card.subject_id && typeof card.subject_id !== 'string') {
      return card.subject_id.name;
    }
    if (typeof card.subject_id === 'string') {
      return this.subjects.find((s) => s._id === card.subject_id)?.name ?? '';
    }
    return '';
  }

  getCardTopicName(card: Flashcard): string {
    if (card.topic_id && typeof card.topic_id !== 'string') {
      return card.topic_id.name;
    }
    if (typeof card.topic_id === 'string') {
      return this.topics.find((t) => t._id === card.topic_id)?.name ?? '';
    }
    return '';
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

  onFlashcardTextClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG') {
      this.selectedImageUrl = (target as HTMLImageElement).src;
      this.isImageModalOpen = true;
      this.imageZoomNeedsInit = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.imageZoomNeedsInit && this.imageModalImgRef) {
      this.imageZoomNeedsInit = false;
      this.initImageZoom();
    }
  }

  ngOnDestroy(): void {
    this.destroyImageZoom();
  }

  onImageModalClosed(): void {
    this.destroyImageZoom();
  }

  zoomIn(): void {
    this.panzoomInstance?.zoomIn();
  }

  zoomOut(): void {
    this.panzoomInstance?.zoomOut();
  }

  resetZoom(): void {
    this.panzoomInstance?.reset();
  }

  private initImageZoom(): void {
    const el = this.imageModalImgRef?.nativeElement;
    if (!el) return;
    this.destroyImageZoom();
    this.panzoomInstance = Panzoom(el, {
      maxScale: 5,
      minScale: 1,
      contain: 'outside',
      step: 0.5,
    });
    el.addEventListener('wheel', this.onImageWheel, { passive: false });
  }

  private destroyImageZoom(): void {
    const el = this.imageModalImgRef?.nativeElement;
    el?.removeEventListener('wheel', this.onImageWheel);
    this.panzoomInstance?.destroy();
    this.panzoomInstance = null;
  }

  async deleteCard(card: Flashcard): Promise<void> {
    if (!card._id) return;
    try {
      await this.flashcardsService.delete(card._id);
      this.flashcards = this.flashcards.filter((c) => c._id !== card._id);
      this.toast.show(this.transloco.translate('home.toast.cardDeleted'), 'success', {
        actionLabel: this.transloco.translate('home.toast.undo'),
        onAction: () => this.undoDeleteCard(card),
        duration: 5000,
      });
    } catch (error: any) {
      this.toast.show(this.transloco.translate('home.toast.deleteError'), 'error');
    }
  }

  private async undoDeleteCard(card: Flashcard): Promise<void> {
    const subjectId = typeof card.subject_id === 'string' ? card.subject_id : card.subject_id?._id;
    const topicId = typeof card.topic_id === 'string' ? card.topic_id : card.topic_id?._id;
    const restoredCard = {
      title: card.title,
      question: card.question,
      answer: card.answer,
      subject_id: subjectId,
      topic_id: topicId,
    } as Flashcard;
    try {
      await this.flashcardsService.create(restoredCard);
      this.toast.show(this.transloco.translate('home.toast.cardRestored'), 'success');
      this.loadFlashcards();
    } catch (error: any) {
      this.toast.show(this.transloco.translate('home.toast.restoreError'), 'error');
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
