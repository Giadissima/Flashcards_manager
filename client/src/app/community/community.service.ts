import {
  FeedDateField,
  FeedPost,
  FeedSort,
  ImportPostRequest,
  ImportResult,
  ImportTargetRequest,
  PostContents,
  ReportRequest,
  ReportResult,
} from '../models/post.dto';

import { Feedback, PostComment } from '../models/social.dto';
import { Flashcard } from '../models/flashcard.dto';
import { Injectable } from '@angular/core';
import { PaginatedResponse } from '../models/http.dto';
import { RestClientService } from '../api/rest-api.service';

/** Everything the feed can be narrowed by, beside its order and its page. */
export interface FeedFilters {
  from?: string;
  to?: string;
  /** Which date the range reads; the server defaults to when it was shared. */
  dateField?: FeedDateField;
  universityCode?: string;
  course?: string;
  courseKind?: string;
  search?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private baseUrl = 'post';

  constructor(private restClient: RestClientService) {}

  getFeed(
    skip: number,
    limit: number,
    sort: FeedSort,
    filters: FeedFilters = {},
  ): Promise<PaginatedResponse<FeedPost>> {
    return this.restClient.get<PaginatedResponse<FeedPost>>(this.baseUrl, {
      skip,
      limit,
      sort,
      // Left out when empty rather than sent as an empty string: the server
      // reads a parameter that is there as a filter to apply
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.dateField ? { dateField: filters.dateField } : {}),
      ...(filters.universityCode ? { universityCode: filters.universityCode } : {}),
      ...(filters.course ? { course: filters.course } : {}),
      ...(filters.courseKind ? { courseKind: filters.courseKind } : {}),
      ...(filters.search ? { search: filters.search } : {}),
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

  /** The topics of a post and how much is in each: the import dialog's tree. */
  getPostContents(postId: string): Promise<PostContents> {
    return this.restClient.get<PostContents>(`${this.baseUrl}/${postId}/contents`);
  }

  /** Copies a whole shared set into the reader's own library. */
  importPost(postId: string, request: ImportPostRequest): Promise<ImportResult> {
    return this.restClient.post(
      `${this.baseUrl}/${postId}/import`,
      request,
    ) as Promise<ImportResult>;
  }

  /** Says a post should not be in the Community, and why. */
  reportPost(postId: string, request: ReportRequest): Promise<ReportResult> {
    return this.restClient.post(
      `${this.baseUrl}/${postId}/report`,
      request,
    ) as Promise<ReportResult>;
  }

  /** True likes the post, false takes the like back. */
  setLike(postId: string, liked: boolean): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/${postId}/like`, { liked });
  }


  /** Copies a public flashcard into the caller's own library. */
  importFlashcard(cardId: string, request: ImportTargetRequest): Promise<void> {
    return this.restClient.post(
      `${this.baseUrl}/flashcards/${cardId}/import`,
      request,
    ) as Promise<void>;
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

  // ------------------------------------------------------------- feedback

  /** Opens a private thread with the author of a flashcard. */
  createFeedback(flashcardId: string, text: string): Promise<void> {
    return this.restClient.post(`${this.baseUrl}/flashcards/${flashcardId}/feedback`, { text });
  }

  /** The reports on my flashcards still waiting to be dealt with. */
  getOpenFeedback(skip: number, limit: number): Promise<PaginatedResponse<Feedback>> {
    return this.restClient.get<PaginatedResponse<Feedback>>(`${this.baseUrl}/feedback/open`, {
      skip,
      limit,
      sortField: '_id',
      sortDirection: 'desc',
    });
  }

  getFeedback(feedbackId: string): Promise<Feedback> {
    return this.restClient.get<Feedback>(`${this.baseUrl}/feedback/${feedbackId}`);
  }

  /** Only the author of the flashcard may. */
  resolveFeedback(feedbackId: string): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/feedback/${feedbackId}/resolve`, {});
  }

  replyToFeedback(feedbackId: string, text: string): Promise<void> {
    return this.restClient.post(`${this.baseUrl}/feedback/${feedbackId}/reply`, { text });
  }

}
