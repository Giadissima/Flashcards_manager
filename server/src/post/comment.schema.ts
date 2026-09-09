import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type CommentDocument = Comment & Document;

/**
 * A public comment under a post: the conversation about what was shared.
 *
 * Flat, with no replies to replies. What people actually need from a shared
 * set - "thanks", "would you add the part on semaphores?" - is a short
 * exchange, and a tree of answers would ask the reader to follow branches for
 * nothing. Pointing out a mistake in one card has its own private channel
 * instead, see Feedback.
 */
@Schema({
  collection: 'comment',
  timestamps: true,
})
export class Comment {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  post_id: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({ required: true })
  text: string;

  /**
   * When the comment was taken out of the thread pending a decision.
   *
   * Only a holding state, unlike a post's own hiddenAt: a comment auto-hidden
   * by reports may go back up once somebody has looked at it, and the report
   * about it still needs something to point at until then. Once an admin
   * decides to remove it for good, the row itself is deleted rather than kept
   * hidden forever - a comment is small enough that there is nothing worth
   * keeping around for.
   */
  @Prop({ required: false, index: true })
  hiddenAt?: Date;

  @Prop({ required: false, enum: ['reports'] })
  hiddenReason?: 'reports';
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
