import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Topic, TopicDocument } from './topic.schema';
import { ModifyTopicDto } from './topic.dto';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  deleteByIdOrThrow,
  findByIdOrThrow,
  findPaginated,
  updateByIdOrThrow,
} from 'src/common/mongo.util';

const ENTITY = 'Topic';
const POPULATE = 'subject_id';

@Injectable()
export class TopicService {
  constructor(@InjectModel(Topic.name) private topicModel: Model<Topic>) {}

  async create(createTopicDto: ModifyTopicDto): Promise<void> {
    await new this.topicModel({ ...createTopicDto }).save();
  }

  findOne(id: string): Promise<TopicDocument> {
    return findByIdOrThrow<TopicDocument>(this.topicModel, id, ENTITY, POPULATE);
  }

  findAll(
    filter: ListFilterRequest,
  ): Promise<BasePaginatedResult<TopicDocument>> {
    const query: FilterQuery<Topic> = {};
    if (filter.subject_id) query.subject_id = filter.subject_id;
    if (filter.title) query.name = { $regex: filter.title, $options: 'i' };

    return findPaginated<TopicDocument>(
      this.topicModel,
      query,
      filter,
      POPULATE,
    );
  }

  delete(id: string): Promise<void> {
    return deleteByIdOrThrow(this.topicModel, id, ENTITY);
  }

  update(id: string, updateObj: ModifyTopicDto): Promise<void> {
    return updateByIdOrThrow(this.topicModel, id, updateObj, ENTITY);
  }
}
