import { TopicFilter, PaginatedResponse } from '../models/http.dto';
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
}
