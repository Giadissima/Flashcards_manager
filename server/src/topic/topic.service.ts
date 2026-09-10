import { PublishingService } from 'src/common/publishing.service';
import { Visibility, defaultVisibility } from 'src/common/visibility';
import { Injectable } from '@nestjs/common';
import { PostService } from 'src/post/post.service';
import { Subject } from 'src/subject/subject.schema';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    private readonly publishing: PublishingService,
  ) {}

  async create(userId: string, createTopicDto: ModifyTopicDto): Promise<void> {
    // A topic added to a subject that is already shared is shared too, unless
    // the form said otherwise: having to publish it again by hand would be a
    // trap, since the subject is public precisely to carry what is under it.
    const visibility =
      createTopicDto.visibility ??
      (await this.parentVisibility(userId, createTopicDto.subject_id));
    // Checked against the resolved value, not the raw one: inheriting public
    // from the subject counts as publishing too.
    await this.publishing.assertMayPublish(userId, visibility);

    // Same idea for spaced repetition: a topic added under a subject whose
    // other topics are all already in it joins them too, rather than sitting
    // out until someone remembers to turn it on by hand.
    const inSpacedRepetition = await this.parentSpacedRepetition(
      userId,
      createTopicDto.subject_id,
    );

    const created = await new this.topicModel({
      ...createTopicDto,
      user_id: userId,
      visibility,
      in_spaced_repetition: inSpacedRepetition,
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

  /**
   * Whether the subject this hangs under currently reads as "on" - every one
   * of its existing topics already in spaced repetition. A subject with no
   * topics yet has nothing to inherit, so a first topic never starts on by
   * itself.
   */
  private async parentSpacedRepetition(
    userId: string,
    subjectId?: string,
  ): Promise<boolean> {
    if (!subjectId) return false;
    const status = await this.spacedRepetitionStatus(userId, [subjectId]);
    return status[subjectId] ?? false;
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
    await this.publishing.assertMayPublish(userId, updateObj.visibility);
    await updateOwnedOrThrow(this.topicModel, id, userId, updateObj, ENTITY);
    if (updateObj.visibility) {
      await this.cascadeVisibility(userId, id, updateObj.visibility);
    }
    await this.refreshPostOf(userId, id);
  }

  /** Only the visibility, for the quick toggle in the lists. */
  async setVisibility(
    userId: string,
    id: string,
    visibility: Visibility,
  ): Promise<void> {
    await this.publishing.assertMayPublish(userId, visibility);
    await updateOwnedOrThrow(
      this.topicModel,
      id,
      userId,
      { visibility },
      ENTITY,
    );
    await this.cascadeVisibility(userId, id, visibility);
    await this.refreshPostOf(userId, id);
  }

  /**
   * Only the spaced-repetition flag, for the quick toggle in the lists.
   * Cascades to the topic's own flashcards the same way visibility does (see
   * cascadeVisibility), so the daily-test query can filter flashcards
   * directly without joining back to this collection.
   */
  async setSpacedRepetition(
    userId: string,
    id: string,
    enabled: boolean,
  ): Promise<void> {
    await updateOwnedOrThrow(
      this.topicModel,
      id,
      userId,
      { in_spaced_repetition: enabled },
      ENTITY,
    );
    await this.flashcardModel
      .updateMany({ user_id: userId, topic_id: id }, { in_spaced_repetition: enabled })
      .exec();
  }

  /**
   * For each given subject, whether every one of its topics currently has
   * spaced repetition on - what the bulk toggle on a subject's own row shows
   * and flips. A subject with no topics, or a mix of on/off ones, reports
   * false: only "all on" reads as on.
   */
  async spacedRepetitionStatus(
    userId: string,
    subjectIds: string[],
  ): Promise<Record<string, boolean>> {
    const rows = await this.topicModel.aggregate<{
      _id: Types.ObjectId;
      total: number;
      enabled: number;
    }>([
      {
        $match: {
          user_id: new Types.ObjectId(userId),
          subject_id: { $in: subjectIds.map((id) => new Types.ObjectId(id)) },
        },
      },
      {
        $group: {
          _id: '$subject_id',
          total: { $sum: 1 },
          enabled: { $sum: { $cond: ['$in_spaced_repetition', 1, 0] } },
        },
      },
    ]);

    const result: Record<string, boolean> = {};
    for (const row of rows) {
      result[row._id.toString()] = row.total > 0 && row.total === row.enabled;
    }
    return result;
  }

  /**
   * Carries the choice down to the flashcards of the topic, both ways round:
   * a topic taken back has to take its cards with it, or they stay out in the
   * open with nothing on screen to say so.
   */
  private async cascadeVisibility(
    userId: string,
    topicId: string,
    visibility: Visibility,
  ): Promise<void> {
    const owned = { user_id: userId, topic_id: topicId };
    await this.flashcardModel.updateMany(owned, { visibility }).exec();
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
