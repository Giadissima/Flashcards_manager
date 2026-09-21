import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

import { TranslocoModule } from '@jsverse/transloco';

/** Outer width of a page-number button (or the ellipsis between two), including its border. */
const PAGE_BUTTON_WIDTH = 40;
/** Gap between two page-number buttons, matching the .pagination-pages CSS gap. */
const PAGE_BUTTON_GAP = 6;
/** Gap around the prev/next buttons, matching the .pagination-bar CSS gap. */
const BAR_GAP = 16;
/** Pages pinned at each end of the row, current page aside. */
const BOUNDARY_COUNT = 1;
/** Pages shown on either side of the current one. */
const SIBLING_COUNT = 1;
/**
 * The windowed row's own width: first page, its ellipsis, the sibling run
 * around the current page, another ellipsis, last page. Kept fixed rather
 * than grown to fill a wide screen - a row of a dozen-plus identical circles
 * reads as noise, not as a shortcut to any one of them.
 */
const WINDOWED_SLOTS = BOUNDARY_COUNT * 2 + SIBLING_COUNT * 2 + 3;
/** Below this, a row of numbers reads as clutter rather than a shortcut. */
const MIN_VISIBLE_PAGES = 3;

const ELLIPSIS = 'ellipsis' as const;
type PageItem = number | typeof ELLIPSIS;

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * The control under a paginated list: a button to either side of the position
 * in the list. The state it shows lives in PaginatedList, which the pages
 * extend; this only draws it and reports what was pressed.
 *
 * The buttons carry an arrow and a word, and drop to the arrow alone on a
 * phone, where the words are what the control can least afford of its width.
 *
 * Where there is room, a row of page numbers takes the place of the plain
 * "Page X of Y" label, sized to whatever fits the bar without overflowing -
 * see updateMaxVisiblePages.
 *
 * Usage:
 *   <app-pagination [currentPage]="currentPage" [totalPages]="totalPages"
 *     (previous)="previousPage()" (next)="nextPage()"></app-pagination>
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss'
})
export class PaginationComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) currentPage = 1;
  @Input({ required: true }) totalPages = 1;

  /** Holds both buttons while the list behind them is being reloaded. */
  @Input() disabled = false;

  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  /** A page number was clicked directly, skipping the arrows. */
  @Output() page = new EventEmitter<number>();

  @ViewChild('bar', { static: true }) private barRef!: ElementRef<HTMLElement>;
  @ViewChild('prevBtn', { static: true }) private prevBtnRef!: ElementRef<HTMLElement>;
  @ViewChild('nextBtn', { static: true }) private nextBtnRef!: ElementRef<HTMLElement>;

  /** How many page-number buttons the bar's current width has room for. */
  maxVisiblePages = 0;

  private resizeObserver?: ResizeObserver;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    // Outside Angular: a window drag fires this many times a second, and the
    // callback only ever touches a plain number - the zone re-enters just
    // once, in updateMaxVisiblePages, to let that change reach the template.
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.updateMaxVisiblePages());
      this.resizeObserver.observe(this.barRef.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /**
   * The row of page numbers: every page when they all fit, otherwise the
   * classic windowed shape (first page, an ellipsis, a few pages around the
   * current one, another ellipsis, last page) - fixed at WINDOWED_SLOTS
   * regardless of how much extra width the bar has, so a wide screen gets a
   * readable row rather than a wall of identical circles.
   *
   * Empty below MIN_VISIBLE_PAGES, where the plain "Page X of Y" label takes
   * over instead.
   */
  get pageItems(): PageItem[] {
    const total = this.totalPages;
    const max = this.maxVisiblePages;
    if (max < MIN_VISIBLE_PAGES || total <= 1) return [];

    if (total <= Math.min(max, WINDOWED_SLOTS)) return range(1, total);
    if (max < WINDOWED_SLOTS) return [];

    const current = this.currentPage;
    const leftSibling = Math.max(current - SIBLING_COUNT, BOUNDARY_COUNT + 2);
    const rightSibling = Math.min(current + SIBLING_COUNT, total - BOUNDARY_COUNT - 1);

    const showLeftEllipsis = leftSibling > BOUNDARY_COUNT + 2;
    const showRightEllipsis = rightSibling < total - BOUNDARY_COUNT - 1;

    const firstPages = range(1, BOUNDARY_COUNT);
    const lastPages = range(total - BOUNDARY_COUNT + 1, total);
    const middleSlots = SIBLING_COUNT * 2 + 3;

    if (!showLeftEllipsis && showRightEllipsis) {
      return [...range(1, middleSlots), ELLIPSIS, ...lastPages];
    }
    if (showLeftEllipsis && !showRightEllipsis) {
      return [...firstPages, ELLIPSIS, ...range(total - middleSlots + 1, total)];
    }
    return [...firstPages, ELLIPSIS, ...range(leftSibling, rightSibling), ELLIPSIS, ...lastPages];
  }

  isEllipsis(item: PageItem): boolean {
    return item === ELLIPSIS;
  }

  goToPage(target: PageItem): void {
    if (target === ELLIPSIS || target === this.currentPage || this.disabled) return;
    this.page.emit(target);
  }

  private updateMaxVisiblePages(): void {
    const bar = this.barRef.nativeElement;
    const reserved =
      this.prevBtnRef.nativeElement.offsetWidth + this.nextBtnRef.nativeElement.offsetWidth + BAR_GAP * 2;
    const available = bar.clientWidth - reserved;
    const max = Math.floor((available + PAGE_BUTTON_GAP) / (PAGE_BUTTON_WIDTH + PAGE_BUTTON_GAP));

    const next = Math.max(0, max);
    if (next === this.maxVisiblePages) return;

    this.zone.run(() => (this.maxVisiblePages = next));
  }
}
