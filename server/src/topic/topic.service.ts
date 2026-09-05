import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Topic, TopicDocument } from './topic.schema';
import { ModifyTopicDto } from './topic.dto';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  deleteOwnedOrThrow,
  findOwnedOrThrow,
  findPaginated,
  updateOwnedOrThrow,
} from 'src/common/mongo.util';

const ENTITY = 'Topic';
const POPULATE = 'subject_id';

@Injectable()
export class TopicService {
  constructor(@InjectModel(Topic.name) private topicModel: Model<Topic>) {}

  async create(userId: string, createTopicDto: ModifyTopicDto): Promise<void> {
    await new this.topicModel({ ...createTopicDto, user_id: userId }).save();
  }

  findOne(userId: string, id: string): Promise<TopicDocument> {
    return findOwnedOrThrow<TopicDocument>(
      this.topicModel,
      id,
      userId,
      ENTITY,
      POPULATE,
    );
  }

  findAll(
    userId: string,
    filter: ListFilterRequest,
  ): Promise<BasePaginatedResult<TopicDocument>> {
    // The owner is not one of the optional filters: it is the first thing every
    // query is narrowed by, so nobody can list what is not theirs.
    const query: FilterQuery<Topic> = { user_id: userId };
    if (filter.subject_id) query.subject_id = filter.subject_id;
    if (filter.title) query.name = { $regex: filter.title, $options: 'i' };

    return findPaginated<TopicDocument>(
      this.topicModel,
      query,
      filter,
      POPULATE,
    );
  }

  delete(userId: string, id: string): Promise<void> {
    return deleteOwnedOrThrow(this.topicModel, id, userId, ENTITY);
  }

  update(
    userId: string,
    id: string,
    updateObj: ModifyTopicDto,
  ): Promise<void> {
    return updateOwnedOrThrow(this.topicModel, id, userId, updateObj, ENTITY);
  }

}
