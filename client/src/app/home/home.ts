import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject as RxSubject, Subscription, debounceTime } from 'rxjs';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { FilterBarComponent } from '../shared/filter-bar/filter-bar.component';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../models/flashcard.dto';
import { FlashcardService } from '../flashcard/flashcard.service';
import { KatexRendererPipe } from '../pipes/katex-renderer.pipe';
import { LoadStateComponent } from '../shared/load-state/load-state.component';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatedList } from '../shared/paginated-list';
import { toSubjectOptions, toTopicOptions } from '../shared/select-options.util';
import * as cardView from '../shared/flashcard-view.util';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';
import { Topic } from '../models/topic.dto';
import { TopicService } from '../topic/topic.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ImageLightboxComponent } from '../shared/image-lightbox/image-lightbox.component';
import { ZoomableImagesDirective } from '../shared/zoomable-images.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Toast, KatexRendererPipe, SearchableSelectComponent, SearchInputComponent, TranslocoModule, ImageLightboxComponent, ZoomableImagesDirective, LoadStateComponent, PaginationComponent, FilterBarComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home extends PaginatedList implements OnInit, OnDestroy {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  flashcards: Flashcard[] = [];
  subjects: Subject[] = [];
  topics: Topic[] = [];
  selectedSubjectId: string | null | undefined = null;
  selectedTopicId: string | null | undefined = null;
  searchTerm: string = '';
  sortBy: 'title' | 'createdAt' = 'title';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Sorting is left out: it always has a value, so it would never read as off.
  get activeFilterCount(): number {
    return [this.selectedSubjectId, this.selectedTopicId, this.searchTerm].filter(
      Boolean,
    ).length;
  }

  override pageSize = 21;

  // Maps a flashcard _id to whether its answer, instead of its question, is shown
  showAnswerMap: Record<string, boolean> = {};

  private queryParamsSubscription?: Subscription;
  // Debounces search-box typing: each keystroke updates searchTerm immediately (so
  // the input feels responsive) but the actual reload only fires 1s after the user
  // stops typing - otherwise every keystroke on a slow connection locks the field.
  private readonly searchTermChanges = new RxSubject<void>();
  private searchTermChangesSubscription?: Subscription;
  // true only for the very first queryParamMap emission: that's the one wrapped
  // in app-load-state. Later ones (filter/sort/page changes) reload in place -
  // swapping the whole page for a spinner on every filter click would be bad UX.
  private isInitialLoad = true;
  // true while a filter/sort/page change is reloading data; disables the filter
  // controls so a slow response can't be overtaken by a second, out-of-order one.
  isReloading = false;

  get subjectOptions(): SelectOption[] {
    return toSubjectOptions(this.subjects);
  }

  get topicOptions(): SelectOption[] {
    return toTopicOptions(this.topics);
  }

  constructor(
    private flashcardsService: FlashcardService,
    private toast: ToastService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private subjectService: SubjectService,
    private topicService: TopicService,
    private transloco: TranslocoService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.searchTermChangesSubscription = this.searchTermChanges.pipe(debounceTime(1000)).subscribe(() => {
      this.currentPage = 1;
      this.updateQueryParams();
    });

    // Subscription, not snapshot: navigating to /home while already on /home
    // (clicking the logo, for instance) makes Angular reuse the existing
    // component and skip ngOnInit, but this subscription fires anyway and
    // re-reads the filters from the URL, keeping the state in sync with the route.
    this.queryParamsSubscription = this.activatedRoute.queryParamMap.subscribe((qp) => {
      this.selectedSubjectId = qp.get('subject_id') || null;
      this.selectedTopicId = qp.get('topic_id') || null;
      this.searchTerm = qp.get('search') || '';
      this.sortBy = (qp.get('sortBy') as 'title' | 'createdAt') || 'title';
      this.sortDirection = (qp.get('sortDirection') as 'asc' | 'desc') || 'asc';
      this.currentPage = Number(qp.get('page')) || 1;

      if (this.isInitialLoad) {
        this.isInitialLoad = false;
        this.loadState.run(() => this.loadInitialData());
      } else {
        this.reloadOnFilterChange();
      }
    });
  }

  // Errors are not handled here: app-load-state intercepts them via run() and shows the 404/error state.
  private async loadInitialData(): Promise<void> {
    this.subjects = await this.subjectService.getSelectableSubjects();

    await this.loadTopicsBySubject(this.selectedSubjectId || undefined);
    await this.loadFlashcards();
  }

  // Used for reloads after the initial load (filter/sort/page changes, restoring a
  // deleted card): those aren't behind app-load-state, so they need their own error
  // surface (a toast) instead of an unhandled rejection.
  private async reloadFlashcards(): Promise<void> {
    try {
      await this.loadFlashcards();
    } catch (err) {
      console.error('Error loading flashcards', err);
      this.toast.show(this.transloco.translate('home.toast.flashcardsLoadError'), 'error');
    }
  }

  // Disables the filter controls for the duration of the reload so a slow response
  // can't be overtaken by a second, out-of-order one.
  private async reloadOnFilterChange(): Promise<void> {
    this.isReloading = true;
    await Promise.all([
      this.loadTopicsBySubject(this.selectedSubjectId || undefined),
      this.reloadFlashcards(),
    ]);
    this.isReloading = false;
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

  async loadFlashcards(): Promise<void> {
    const data = await this.flashcardsService.getAll({
      sortField: this.sortBy,
      sortDirection: this.sortDirection,
      skip: this.pageSkip,
      limit: this.pageSize,
      subject_id: this.selectedSubjectId || undefined,
      topic_id: this.selectedTopicId || undefined,
      title: this.searchTerm || undefined,
    });
    this.flashcards = data.data;
    this.totalCount = data.count;
  }

  // Paging goes through the URL: the queryParamMap subscription reloads.
  protected override onPageChange(): void {
    this.updateQueryParams();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.updateQueryParams();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.searchTermChanges.next();
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
  }

  getCardColor(card: Flashcard): string {
    return cardView.getCardColor(card);
  }

  getCardSubjectIconUrl(card: Flashcard): string {
    return cardView.getCardSubjectIconUrl(card);
  }

  getCardSubjectName(card: Flashcard): string {
    return cardView.getCardSubjectName(card);
  }

  getCardTopicName(card: Flashcard): string {
    return cardView.getCardTopicName(card);
  }

  getCardBody(card: Flashcard): string {
    return cardView.getCardBody(card, this.showAnswerMap[card._id]);
  }

  // Switches between "See answer" and "See question"
  getCardButtonText(card: Flashcard): string {
    return this.transloco.translate(this.showAnswerMap[card._id] ? 'home.seeQuestion' : 'home.seeAnswer');
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.searchTermChangesSubscription?.unsubscribe();
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
      this.reloadFlashcards();
    } catch (error: any) {
      this.toast.show(this.transloco.translate('home.toast.restoreError'), 'error');
    }
  }

  async loadTopicsBySubject(subjectId: string | undefined) {
    try {
      this.topics = await this.topicService.getSelectableTopics(subjectId);
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
    // 1. Build the text to copy
    const textToCopy = `${card.title}\nQuestion: ${card.question}\nAnswer: ${card.answer}`;

    // 2. Try the modern route (Clipboard API)
    // It only exists in a secure context (HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          this.toast.show(this.transloco.translate('home.toast.cardCopied'), 'success');
        })
        .catch((err) => {
          // Should the modern API fail anyway, fall back
          this.executeFallbackCopy(textToCopy);
        });
    } else {
      // 3. No modern API (a plain HTTP private network, say): use the fallback
      this.executeFallbackCopy(textToCopy);
    }
  }

  private executeFallbackCopy(text: string): void {
    // An off-screen textarea is needed: execCommand('copy') copies the current
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // selection, not an arbitrary string
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);

    // Select its content
    textArea.focus();
    textArea.select();

    try {
      // The legacy command, for plain http URLs
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
    this.selectedTopicId = null;
    this.onFilterChange();
  }

  onTopicSelected(id: string | null | undefined): void {
    this.selectedTopicId = id;
    this.onFilterChange();
  }
}
