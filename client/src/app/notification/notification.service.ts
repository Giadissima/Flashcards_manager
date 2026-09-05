import { AppNotification } from '../models/social.dto';
import { Injectable } from '@angular/core';
import { PaginatedResponse } from '../models/http.dto';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'notification';

  constructor(private restClient: RestClientService) {}

  getMine(skip: number, limit: number): Promise<PaginatedResponse<AppNotification>> {
    return this.restClient.get<PaginatedResponse<AppNotification>>(this.baseUrl, {
      skip,
      limit,
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
