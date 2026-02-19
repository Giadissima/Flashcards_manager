import { TopicFilter, PaginatedResponse } from '../models/http.dto';
import { Topic } from '../models/topic.dto';
import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { baseUrlAPI } from '../../config/config';

@Injectable({
  providedIn: 'root',
})
export class TopicService {
  private baseUrl = 'topic/';

  constructor(private restClient: RestClientService) {}

  getAllTopics(filter: TopicFilter): Promise<PaginatedResponse<Topic>> {
    return this.restClient.get<PaginatedResponse<Topic>>(
      this.baseUrl,
      filter,
    );
  }

  getTopicById(id: string): Promise<Topic> {
    return this.restClient.get<Topic>(this.baseUrl + id);
  }

  createTopic(topic: Topic): Promise<void> {
    return this.restClient.post(this.baseUrl, topic);
  }

  updateTopic(id: string, topic: Partial<Topic>): Promise<void> {
    return this.restClient.patch(this.baseUrl + id, topic);
  }

  deleteTopic(id: string): Promise<void> {
    return this.restClient.delete(this.baseUrl + id);
  }
}
