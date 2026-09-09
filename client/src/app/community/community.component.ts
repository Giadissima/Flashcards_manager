import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject as RxSubject, Subscription, debounceTime } from 'rxjs';
import {
  FeedDateField,
  FeedPost,
  FeedSort,
  feedDateFields,
  feedSorts,
} from '../models/post.dto';

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
    RouterLink,
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
  private queryParamsSubscription?: Subscription;
  // true only for the very first queryParamMap emission: that is the one wrapped
  // in app-load-state. Later ones (filter, sort, page) reload in place - swapping
  // the whole page for a spinner on every filter click would be bad UX.
  private isInitialLoad = true;

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

  /**
   * False only until the reader's university scope is settled - by their own
   * profile having one, or by an explicit filter choice (including choosing
   * "all universities" on purpose). Until then the feed asks for nothing:
   * showing everyone's posts to someone who never chose to see them would mean
   * a brand-new account with no university sees random Engineering, Nursing
   * and Computer Science posts mixed together on the very first visit.
   */
  scopeChosen = false;

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.searchSubscription = this.searchChanges
      .pipe(debounceTime(500))
      .subscribe(() => this.onFilterChange());

    // Subscription, not snapshot: navigating to /community while already on
    // /community makes Angular reuse the existing component and skip ngOnInit,
    // but this subscription fires anyway and re-reads the filters from the URL,
    // keeping the state in sync with the route.
    this.queryParamsSubscription = this.activatedRoute.queryParamMap.subscribe((qp) => {
      this.sort = this.readOption(qp.get('sort'), feedSorts, 'created');
      this.dateFrom = qp.get('from') || null;
      this.dateTo = qp.get('to') || null;
      this.dateField = this.readOption(qp.get('dateField'), feedDateFields, 'created');
      this.searchTerm = qp.get('search') || '';
      this.page = Math.max(0, (Number(qp.get('page')) || 1) - 1);
      this.study = this.readStudy(qp);

      if (this.isInitialLoad) {
        this.isInitialLoad = false;
        this.loadState.run(() => this.loadFeed());
      } else {
        void this.loadFeed();
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.queryParamsSubscription?.unsubscribe();
  }

  /** Anything the address is not allowed to say reads as the default. */
  private readOption<T extends string>(
    value: string | null,
    allowed: readonly T[],
    fallback: T,
  ): T {
    return allowed.includes(value as T) ? (value as T) : fallback;
  }

  /**
   * Where the reader studies is the corner of the Community their own course is
   * in: the one place worth opening on, so an address carrying no filters at all
   * starts there. Once the filters have been written to the address - and `sort`
   * always is - an absent university means the reader cleared it, not that they
   * never chose, and the feed stays as they left it.
   */
  private readStudy(qp: ParamMap): StudyFields {
    const universityCode = qp.get('university');
    if (!universityCode && !qp.has('sort')) {
      const user = this.authService.user;
      // No filter has ever been touched: a university on the profile settles
      // the scope, but its absence does not - that is not yet a choice.
      this.scopeChosen = !!user?.universityCode;
      return {
        universityCode: user?.universityCode ?? null,
        course: user?.course ?? null,
        courseKind: user?.courseKind ?? null,
      };
    }
    this.scopeChosen = true;
    return {
      universityCode: universityCode || null,
      course: qp.get('course') || null,
      courseKind: qp.get('courseKind') || null,
    };
  }

  /**
   * The filters live in the address, and the feed reloads through the
   * queryParamMap subscription: a read can then be sent to somebody else, or
   * reopened later exactly as it was left.
   */
  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        sort: this.sort,
        from: this.dateFrom,
        to: this.dateTo,
        dateField: this.dateField,
        search: this.searchTerm.trim() || null,
        university: this.study.universityCode,
        course: this.study.course,
        courseKind: this.study.courseKind,
        page: this.currentPage,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSearchTermChange(term: string): void {
    this.searchTerm = term;
    this.searchChanges.next();
  }

  onStudyChange(study: StudyFields): void {
    this.study = study;
    this.onFilterChange();
  }

  /** Any filter change: back to the first page, since the pages have moved. */
  private onFilterChange(): void {
    this.page = 0;
    this.updateQueryParams();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / pageSize));
  }

  onSortChange(sort: string): void {
    this.sort = sort as FeedSort;
    // Back to the first page: the second page of one order says nothing about
    // the same position in the other
    this.onFilterChange();
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.onFilterChange();
  }

  onDateFieldChange(field: string): void {
    this.dateField = field as FeedDateField;
    // The choice belongs in the address either way, but only a range makes it
    // change what is shown: with both ends open, either date matches every post
    // there is, so the feed is left alone and only the URL is written.
    if (this.dateFrom || this.dateTo) this.onFilterChange();
    else this.updateQueryParams();
  }

  /** app-pagination counts from 1, the feed skips from 0. */
  get currentPage(): number {
    return this.page + 1;
  }

  previousPage(): void {
    if (this.page === 0) return;
    this.page--;
    this.updateQueryParams();
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.page++;
    this.updateQueryParams();
  }

  private async loadFeed(): Promise<void> {
    if (!this.scopeChosen) {
      this.posts = [];
      this.total = 0;
      return;
    }

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
