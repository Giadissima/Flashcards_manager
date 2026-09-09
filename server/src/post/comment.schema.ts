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
   * When the comment was taken out of the thread, and why.
   *
   * Same idea as a post's own hiddenAt: kept rather than deleted, since a
   * comment auto-hidden by reports may go back up once somebody has looked at
   * it, and the report about it still needs something to point at.
   */
  @Prop({ required: false, index: true })
  hiddenAt?: Date;

  @Prop({ required: false, enum: ['reports', 'admin'] })
  hiddenReason?: 'reports' | 'admin';
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
