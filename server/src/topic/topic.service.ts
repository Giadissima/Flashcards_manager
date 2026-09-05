import { Visibility, defaultVisibility } from 'src/common/visibility';
import { Injectable } from '@nestjs/common';
import { PostService } from 'src/post/post.service';
import { Subject } from 'src/subject/subject.schema';
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
  constructor(
    @InjectModel(Topic.name) private topicModel: Model<Topic>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    private readonly postService: PostService,
  ) {}

  async create(userId: string, createTopicDto: ModifyTopicDto): Promise<void> {
    const created = await new this.topicModel({
      ...createTopicDto,
      user_id: userId,
      // A topic added to a subject that is already shared is shared too, unless
      // the form said otherwise: having to publish it again by hand would be a
      // trap, since the subject is public precisely to carry what is under it.
      visibility:
        createTopicDto.visibility ??
        (await this.parentVisibility(userId, createTopicDto.subject_id)),
    }).save();

    await this.postService.refresh(userId, created.subject_id);
  }

  /** "public" when the subject this hangs under is itself public. */
  private async parentVisibility(
    userId: string,
    subjectId?: string,
  ): Promise<Visibility> {
    if (!subjectId) return defaultVisibility;

    const subject = await this.subjectModel
      .findOne({ _id: subjectId, user_id: userId }, { visibility: 1 })
      .lean()
      .exec();
    return subject?.visibility === 'public' ? 'public' : defaultVisibility;
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

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.topicModel
      .findOne({ _id: id, user_id: userId }, { subject_id: 1 })
      .lean()
      .exec();

    await deleteOwnedOrThrow(this.topicModel, id, userId, ENTITY);
    if (existing?.subject_id) {
      await this.postService.refresh(userId, existing.subject_id);
    }
  }

  async update(
    userId: string,
    id: string,
    updateObj: ModifyTopicDto,
  ): Promise<void> {
    await updateOwnedOrThrow(this.topicModel, id, userId, updateObj, ENTITY);
    await this.refreshPostOf(userId, id);
  }

  /** Only the visibility, for the quick toggle in the lists. */
  async setVisibility(
    userId: string,
    id: string,
    visibility: Visibility,
  ): Promise<void> {
    await updateOwnedOrThrow(
      this.topicModel,
      id,
      userId,
      { visibility },
      ENTITY,
    );
    await this.refreshPostOf(userId, id);
  }

  private async refreshPostOf(userId: string, topicId: string): Promise<void> {
    const topic = await this.topicModel
      .findOne({ _id: topicId, user_id: userId }, { subject_id: 1 })
      .lean()
      .exec();
    if (topic?.subject_id) {
      await this.postService.refresh(userId, topic.subject_id);
    }
  }

}
