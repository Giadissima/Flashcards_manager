import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type NotificationDocument = Notification & Document;

/**
 * What happened. Each kind carries the id the panel needs to open the thing it
 * is about, which is why they are not one generic "target".
 */
export const notificationKinds = [
  'upvote',
  'comment',
  'feedback',
  'resolved',
  'moderation',
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/** What was decided about the account, on the one kind nobody else causes. */
export const moderationEvents = [
  'warned',
  'blocked',
  'lifted',
  'removed',
] as const;
export type ModerationEvent = (typeof moderationEvents)[number];

/**
 * The particulars of a moderation notice.
 *
 * Stored apart rather than written into the preview: the panel says it in the
 * reader's language and shows the date in their own format, and a sentence
 * baked in here would be in whatever language the server happened to think in.
 */
@Schema({ _id: false })
export class ModerationDetails {
  @Prop({ required: true, enum: moderationEvents })
  event: ModerationEvent;

  /** What was taken away, on 'blocked'; what came back, on 'lifted'. */
  @Prop({ type: [String], default: [] })
  privileges: string[];

  /** When they come back. Absent means there is no date to wait for. */
  @Prop({ required: false })
  until?: Date;
}

export const ModerationDetailsSchema =
  SchemaFactory.createForClass(ModerationDetails);

/**
 * Something somebody else did that its owner should hear about.
 *
 * Written when the event happens rather than worked out on the way in: the
 * panel has to be cheap to open and to count, and reconstructing "what is new
 * for me" out of votes, comments and feedback on every visit would grow with
 * the whole history.
 */
@Schema({
  collection: 'notification',
  timestamps: true,
})
export class Notification {
  /** Who it is for. */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  /**
   * Who caused it. Never the recipient: nobody is told about their own doing.
   *
   * Absent on the notices that come from the moderation of the site itself,
   * which is nobody's account and must not be shown as one.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  actor_id?: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: notificationKinds })
  kind: NotificationKind;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: false })
  post_id?: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback',
    required: false,
  })
  feedback_id?: mongoose.Types.ObjectId;

  /** A line of what was written, so the panel says something without a join. */
  @Prop({ required: false })
  preview?: string;

  /** Only on 'moderation': what was decided, and until when. */
  @Prop({ type: ModerationDetailsSchema, required: false })
  moderation?: ModerationDetails;

  @Prop({ required: true, default: false, index: true })
  read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// The panel always asks the same two questions: my newest, and how many unread
NotificationSchema.index({ user_id: 1, createdAt: -1 });
NotificationSchema.index({ user_id: 1, read: 1 });
