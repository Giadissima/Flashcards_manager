/**
 * Page state shared by every list in the app (home, manage topics, manage
 * subjects, test history, test runner): they all keep a current page, a fixed
 * page size and a total count coming from the server, and they all page with
 * the same two buttons. Subclasses declare their pageSize and say what to do
 * when the page changes - which was the only line that differed between the
 * five copies of this code.
 *
 * A plain base class on purpose: nothing here uses an Angular feature (no DI,
 * no inputs, no lifecycle hooks), so components can simply extend it.
 */
export abstract class PaginatedList {
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.onPageChange();
  }

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.onPageChange();
  }

  /** Offset of the first item of the current page, for the `skip` query param. */
  protected get pageSkip(): number {
    return (this.currentPage - 1) * this.pageSize;
  }

  /** Reload, or re-route, after currentPage moved. */
  protected abstract onPageChange(): void;
}
