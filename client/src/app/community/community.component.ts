import { Component, OnInit, ViewChild } from '@angular/core';
import { FeedPost, FeedSort } from '../models/post.dto';

import { CommonModule } from '@angular/common';
import { CommunityService } from './community.service';
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
  ],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
})
export class CommunityComponent implements OnInit {
  @ViewChild(LoadStateComponent, { static: true }) loadState!: LoadStateComponent;

  posts: FeedPost[] = [];
  total = 0;
  page = 0;
  sort: FeedSort = 'created';
  /** The two ends of the range, as YYYY-MM-DD days; null is an open end. */
  dateFrom: string | null = null;
  dateTo: string | null = null;
  readonly pageSize = pageSize;

  constructor(private communityService: CommunityService) {}

  ngOnInit(): void {
    this.loadState.run(() => this.loadFeed());
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
    // Back to the first page, as with the order: the second page of one range
    // has nothing to do with the second page of another
    this.page = 0;
    await this.loadFeed();
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
      { from: this.dateFrom ?? undefined, to: this.dateTo ?? undefined },
    );
    this.posts = feed.data;
    this.total = feed.count;
  }
}
