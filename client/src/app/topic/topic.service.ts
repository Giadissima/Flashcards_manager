import { TopicFilter, PaginatedResponse } from '../models/http.dto';
import { Visibility } from '../models/visibility.dto';
import { Topic } from '../models/topic.dto';
import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { selectableListLimit } from '../../config/config';

@Injectable({
  providedIn: 'root',
})
export class TopicService {
  private baseUrl = 'topic';

  constructor(private restClient: RestClientService) {}

  getAllTopics(filter: TopicFilter): Promise<PaginatedResponse<Topic>> {
    return this.restClient.get<PaginatedResponse<Topic>>(
      this.baseUrl,
      filter,
    );
  }

  /**
   * The alphabetical list every topic dropdown is filled with; without a
   * subject it returns the topics of every subject.
   */
  async getSelectableTopics(subjectId?: string): Promise<Topic[]> {
    const response = await this.getAllTopics({
      skip: 0,
      limit: selectableListLimit,
      sortField: 'name',
      sortDirection: 'asc',
      subject_id: subjectId,
    });
    return response.data;
  }

  getTopicById(id: string): Promise<Topic> {
    return this.restClient.get<Topic>(this.baseUrl + '/' + id);
  }

  createTopic(topic: Topic): Promise<void> {
    return this.restClient.post(this.baseUrl, topic);
  }

  updateTopic(id: string, topic: Partial<Topic>): Promise<void> {
    return this.restClient.patch(this.baseUrl + '/' + id, topic);
  }

  deleteTopic(id: string): Promise<void> {
    return this.restClient.delete(this.baseUrl + '/' + id);
  }

  /**
   * Only the visibility, for the quick toggle in the lists: the full update
   * endpoint wants every field of the entity, which a list does not hold.
   */
  setVisibility(id: string, visibility: Visibility): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/${id}/visibility`, { visibility });
  }

  /** Only the spaced-repetition flag, for the quick toggle in the lists. */
  setSpacedRepetition(id: string, enabled: boolean): Promise<void> {
    return this.restClient.patch(`${this.baseUrl}/${id}/spaced-repetition`, { enabled });
  }

  /**
   * For each given subject, whether every one of its topics is currently in
   * spaced repetition - what the bulk toggle on a subject's own row shows.
   */
  getSpacedRepetitionStatus(subjectIds: string[]): Promise<Record<string, boolean>> {
    if (!subjectIds.length) return Promise.resolve({});
    return this.restClient.get<Record<string, boolean>>(
      `${this.baseUrl}/spaced-repetition-status`,
      { subject_ids: subjectIds },
    );
  }

}
