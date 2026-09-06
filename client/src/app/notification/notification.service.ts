import { AppNotification, NotificationKind } from '../models/social.dto';
import { Injectable } from '@angular/core';
import { PaginatedResponse } from '../models/http.dto';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'notification';

  constructor(private restClient: RestClientService) {}

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

  markRead(id: string): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/${id}/read`, {});
  }

  markAllRead(): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/read`, {});
  }
}
