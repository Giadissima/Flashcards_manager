import { FeedPost, FeedSort } from '../models/post.dto';

import { Flashcard } from '../models/flashcard.dto';
import { Injectable } from '@angular/core';
import { PaginatedResponse } from '../models/http.dto';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private baseUrl = 'post';

  constructor(private restClient: RestClientService) {}

  getFeed(skip: number, limit: number, sort: FeedSort): Promise<PaginatedResponse<FeedPost>> {
    return this.restClient.get<PaginatedResponse<FeedPost>>(this.baseUrl, {
      skip,
      limit,
      sort,
      // The server asks every paginated list for these two; the feed decides
      // its own order from `sort`, so they are only here to satisfy the DTO.
      sortField: '_id',
      sortDirection: 'desc',
    });
  }

  /** One page of a post's carousel. */
  getFlashcards(postId: string, skip: number, limit: number): Promise<PaginatedResponse<Flashcard>> {
    return this.restClient.get<PaginatedResponse<Flashcard>>(
      `${this.baseUrl}/${postId}/flashcards`,
      { skip, limit },
    );
  }
}
