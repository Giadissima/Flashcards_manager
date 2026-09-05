import { Model, Types } from 'mongoose';
import { Notification, NotificationKind } from './notification.schema';

import { BasePaginatedResult } from 'src/common.dto';
import { BasicFilterRequest } from 'src/common.dto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

/** What a notification needs to be recorded. */
export interface NewNotification {
  userId: string | Types.ObjectId;
  actorId: string | Types.ObjectId;
  kind: NotificationKind;
  postId?: Types.ObjectId;
  feedbackId?: Types.ObjectId;
  preview?: string;
}

/** A line of the panel, short enough to read at a glance. */
const previewLength = 120;

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
  ) {}

  /**
   * Records one, unless it would be addressed to the person who caused it:
   * commenting on your own post, or voting it, is not news to you.
   */
  async record(event: NewNotification): Promise<void> {
    const user_id = new Types.ObjectId(String(event.userId));
    const actor_id = new Types.ObjectId(String(event.actorId));
    if (user_id.equals(actor_id)) return;

    await this.notificationModel.create({
      user_id,
      actor_id,
      kind: event.kind,
      post_id: event.postId,
      feedback_id: event.feedbackId,
      preview: event.preview?.slice(0, previewLength),
      read: false,
    });
  }

  async findMine(
    userId: string,
    filter: BasicFilterRequest,
  ): Promise<BasePaginatedResult<Notification>> {
    const query = { user_id: new Types.ObjectId(userId) };

    const [data, count] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('actor_id', 'username avatar avatarColor')
        .lean()
        .exec(),
      this.notificationModel.countDocuments(query),
    ]);
    return { data: data as unknown as Notification[], count };
  }

  countUnread(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ user_id: new Types.ObjectId(userId), read: false })
      .exec();
  }

  /** Marks one as read, or all of them when no id is given. */
  async markRead(userId: string, id?: string): Promise<void> {
    const query: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
      read: false,
    };
    if (id) query._id = new Types.ObjectId(id);

    await this.notificationModel.updateMany(query, { read: true }).exec();
  }
}
