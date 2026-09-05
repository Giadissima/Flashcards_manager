import { FeedPost, FeedSort } from '../models/post.dto';

import { PostComment } from '../models/social.dto';
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

  /** 1 up, -1 down, 0 to take the vote back. */
  vote(postId: string, value: number): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/${postId}/vote`, { value });
  }


  /** Copies a public flashcard into the caller's own library. */
  importFlashcard(flashcardId: string): Promise<void> {
    return this.restClient.post(`${this.baseUrl}/flashcards/${flashcardId}/import`, {});
  }


  // ------------------------------------------------------------- comments

  getComments(postId: string, skip: number, limit: number): Promise<PaginatedResponse<PostComment>> {
    return this.restClient.get<PaginatedResponse<PostComment>>(
      `${this.baseUrl}/${postId}/comments`,
      { skip, limit, sortField: '_id', sortDirection: 'desc' },
    );
  }

  addComment(postId: string, text: string): Promise<void> {
    return this.restClient.post(`${this.baseUrl}/${postId}/comments`, { text });
  }

  deleteComment(commentId: string): Promise<void> {
    return this.restClient.delete(`${this.baseUrl}/comments/${commentId}`);
  }


}
