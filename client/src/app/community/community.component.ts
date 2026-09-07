import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject as RxSubject, Subscription, debounceTime } from 'rxjs';
import { FeedDateField, FeedPost, FeedSort } from '../models/post.dto';

import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { CommunityService } from './community.service';
import { FilterBarComponent } from '../shared/filter-bar/filter-bar.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';
import {
  StudyFields,
  StudyFieldsComponent,
  emptyStudyFields,
} from '../university/study-fields/study-fields.component';
import {
  DateRange,
  DateRangeFilterComponent,
} from '../shared/date-range-filter/date-range-filter.component';
import { LoadStateComponent } from '../shared/load-state/load-state.component';
import { PageCardComponent } from '../shared/page-card/page-card.component';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { PostCardComponent } from './post-card/post-card.component';
import { SegmentedFilterComponent } from '../shared/segmented-filter/segmented-filter.component';
import { TranslocoModule } from '@jsverse/transloco';

const pageSize = 5;

/**
 * The Community feed: what other people have chosen to share, newest first.
 *
 * The two orders answer two different questions - what has just been shared,
 * and what somebody has just added to - which is why the "updated" one exists
 * at all: a post that grows a card a week would never resurface otherwise.
 */
@Component({
  selector: 'app-community',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    PageCardComponent,
    LoadStateComponent,
    PaginationComponent,
    PostCardComponent,
    SegmentedFilterComponent,
    DateRangeFilterComponent,
    FilterBarComponent,
    SearchInputComponent,
    StudyFieldsComponent,
  ],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
})
export class CommunityComponent implements OnInit, OnDestroy {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  posts: FeedPost[] = [];
  total = 0;
  page = 0;
  sort: FeedSort = 'created';
  /** The two ends of the range, as YYYY-MM-DD days; null is an open end. */
  dateFrom: string | null = null;
  dateTo: string | null = null;
  /** Which of the two dates that range reads. */
  dateField: FeedDateField = 'created';

  /** Which university and course the feed is being read from. */
  study: StudyFields = emptyStudyFields();
  searchTerm = '';

  // Typed letter by letter, so the request waits for the typing to stop: a
  // search is three collections asked at once on the server side.
  private readonly searchChanges = new RxSubject<void>();
  private searchSubscription?: Subscription;

  get activeFilterCount(): number {
    return [
      this.searchTerm,
      // One filter and not two: an open end is still the same range
      this.dateFrom || this.dateTo,
      this.study.universityCode,
      this.study.course,
    ].filter(Boolean).length;
  }
  readonly pageSize = pageSize;

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Where the reader studies, which is the corner of the Community their own
    // course is in: the one place worth opening on.
    const user = this.authService.user;
    this.study = {
      universityCode: user?.universityCode ?? null,
      course: user?.course ?? null,
      courseKind: user?.courseKind ?? null,
    };

    this.searchSubscription = this.searchChanges
      .pipe(debounceTime(500))
      .subscribe(() => void this.reload());

    this.loadState.run(() => this.loadFeed());
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.searchChanges.next();
  }

  async onStudyChange(study: StudyFields): Promise<void> {
    this.study = study;
    await this.reload();
  }

  /** Any filter change: back to the first page, since the pages have moved. */
  private async reload(): Promise<void> {
    this.page = 0;
    await this.loadFeed();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / pageSize));
  }

  async onSortChange(sort: string): Promise<void> {
    this.sort = sort as FeedSort;
    // Back to the first page: the second page of one order says nothing about
    // the same position in the other
    this.page = 0;
    await this.loadFeed();
  }

  async onDateRangeChange(range: DateRange): Promise<void> {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    await this.reload();
  }

  async onDateFieldChange(field: string): Promise<void> {
    this.dateField = field as FeedDateField;
    // Only worth a request when there is a range for it to read: with both
    // ends open, either date matches every post there is.
    if (this.dateFrom || this.dateTo) await this.reload();
  }

  /** app-pagination counts from 1, the feed skips from 0. */
  get currentPage(): number {
    return this.page + 1;
  }

  async previousPage(): Promise<void> {
    if (this.page === 0) return;
    this.page--;
    await this.loadFeed();
  }

  async nextPage(): Promise<void> {
    if (this.currentPage >= this.totalPages) return;
    this.page++;
    await this.loadFeed();
  }

  private async loadFeed(): Promise<void> {
    const feed = await this.communityService.getFeed(
      this.page * pageSize,
      pageSize,
      this.sort,
      {
        from: this.dateFrom ?? undefined,
        to: this.dateTo ?? undefined,
        dateField: this.dateField,
        universityCode: this.study.universityCode ?? undefined,
        course: this.study.course ?? undefined,
        courseKind: this.study.courseKind ?? undefined,
        search: this.searchTerm.trim() || undefined,
      },
    );
    this.posts = feed.data;
    this.total = feed.count;
  }
}
