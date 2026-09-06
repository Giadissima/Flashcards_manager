import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type VoteDocument = Vote & Document;

/**
 * One like per person and post: the unique index is what makes a second click
 * take the like back instead of stacking another point.
 *
 * The like is the document itself - there is nothing to record about it, and
 * taking it back deletes the row. The collection is still named 'vote', from
 * when a post could be voted down as well: renaming it would move the likes
 * already given for no gain.
 *
 * Kept as its own documents rather than as a list on the post, because the
 * feed has to answer "did I like this" for the person reading it, and an
 * array on the post would be read in full to find one entry.
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
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

VoteSchema.index({ user_id: 1, post_id: 1 }, { unique: true });
