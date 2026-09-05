import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type VoteDocument = Vote & Document;

/** Up or down. Removing a vote deletes the document rather than storing a 0. */
export const voteValues = [1, -1] as const;
export type VoteValue = (typeof voteValues)[number];

/**
 * One vote per person and post: the unique index is what makes a second click
 * change a mind instead of stacking another point.
 *
 * Kept as its own documents rather than as a list on the post, because the
 * feed has to answer "how did I vote on this" for the person reading it, and
 * an array on the post would be read in full to find one entry.
 */
@Schema({
  collection: 'vote',
  timestamps: true,
})
export class Vote {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  post_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: voteValues })
  value: VoteValue;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

VoteSchema.index({ user_id: 1, post_id: 1 }, { unique: true });
