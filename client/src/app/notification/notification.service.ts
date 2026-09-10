import { AppNotification, NotificationKind } from '../models/social.dto';
import { BehaviorSubject, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { PaginatedResponse } from '../models/http.dto';
import { RestClientService } from '../api/rest-api.service';
import { AuthService } from '../auth/auth.service';
import { baseUrlAPI } from '../../config/config';
import { fetchEventSource } from '@microsoft/fetch-event-source';

/**
 * Owns the unread count as one shared value, rather than each bell reading it
 * on its own: the navbar renders two of them at once (desktop bar and mobile
 * drawer), and only one SSE connection should be open for both.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'notification';

  private readonly _unread = new BehaviorSubject<number>(0);
  readonly unread$ = this._unread.asObservable();

  private streamAbort: AbortController | null = null;

  constructor(
    private restClient: RestClientService,
    private authService: AuthService,
  ) {
    // Opens once per session, closes on logout - a stream held open for a
    // signed-out user would just keep retrying against a 401.
    this.authService.user$.subscribe((user) => {
      if (user) this.connectStream();
      else this.disconnectStream();
    });
  }

  getMine(
    skip: number,
    limit: number,
    filter: { kind?: NotificationKind; unread?: boolean } = {},
  ): Promise<PaginatedResponse<AppNotification>> {
    return this.restClient.get<PaginatedResponse<AppNotification>>(this.baseUrl, {
      skip,
      limit,
      // Left out entirely when not set: the server reads "unread=false" as no
      // filter, but sending nothing says it more plainly
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.unread ? { unread: true } : {}),
      // The server asks every paginated list for these two; notifications are
      // always newest first, so they are here only to satisfy the DTO.
      sortField: '_id',
      sortDirection: 'desc',
    });
  }

  countUnread(): Promise<number> {
    return this.restClient.get<number>(`${this.baseUrl}/unread-count`);
  }

  /** Re-reads the count from the server and republishes it to every bell. */
  async refreshUnread(): Promise<void> {
    try {
      this._unread.next(Number(await this.countUnread()) || 0);
    } catch {
      this._unread.next(0);
    }
  }

  async markRead(id: string): Promise<void> {
    await this.restClient.patch(`${this.baseUrl}/${id}/read`, {});
    this._unread.next(Math.max(0, this._unread.value - 1));
  }

  async markAllRead(): Promise<void> {
    await this.restClient.patch(`${this.baseUrl}/read`, {});
    this._unread.next(0);
  }

  /**
   * Keeps a single SSE connection open for the whole session: the server
   * pushes one empty event per new notification, which is enough to know the
   * count is stale and worth re-fetching.
   */
  private connectStream(): void {
    if (this.streamAbort) return;
    this.streamAbort = new AbortController();
    void this.refreshUnread();

    void fetchEventSource(this.streamUrl(), {
      headers: this.authService.token ? { Authorization: `Bearer ${this.authService.token}` } : {},
      signal: this.streamAbort.signal,
      // The badge should keep up even while the tab sits in the background.
      openWhenHidden: true,
      onmessage: () => {
        void this.refreshUnread();
      },
      // Left to its own devices, fetchEventSource retries with a backoff on
      // any error instead of giving up - exactly what a dropped connection
      // needs, and throwing here would turn that off.
      onerror: () => undefined,
    });
  }

  private disconnectStream(): void {
    this.streamAbort?.abort();
    this.streamAbort = null;
    this._unread.next(0);
  }

  private streamUrl(): string {
    const base = baseUrlAPI.endsWith('/') ? baseUrlAPI : `${baseUrlAPI}/`;
    return `${base}${this.baseUrl}/stream`;
  }
}
