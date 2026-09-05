import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type PostDocument = Post & Document;

/**
 * What a post covers. "subject" means the whole subject was shared, so every
 * topic and flashcard under it travels with it and the header names the subject
 * alone; "partial" means only some topics or some loose flashcards were.
 */
export const postScopes = ['subject', 'partial'] as const;
export type PostScope = (typeof postScopes)[number];

/**
 * One post per user and subject, which is what keeps the feed quiet: sharing a
 * second flashcard, or a second topic of the same subject, lands in the post
 * that is already there and only moves its updatedAt.
 *
 * The post stores what was shared and when; the flashcards shown in its
 * carousel are read live from their own visibility instead of being copied
 * here. A stored list would have to be mended every time a card is deleted or
 * made private again, and a missed update would show a card that no longer
 * exists - or worse, one its author has taken back.
 */
@Schema({
  collection: 'post',
  timestamps: true,
})
export class Post {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true,
  })
  subject_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: postScopes, default: 'partial' })
  scope: PostScope;

  /** Topics shared whole. Empty on a post made only of loose flashcards. */
  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'Topic', default: [] })
  topic_ids: mongoose.Types.ObjectId[];

  /**
   * Flashcards shared one by one. Kept even when a topic covering them is
   * shared later, so taking that topic back does not silently withdraw cards
   * the user had published on their own.
   */
  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Flashcard',
    default: [],
  })
  flashcard_ids: mongoose.Types.ObjectId[];

  /**
   * Upvotes minus downvotes, kept here so the feed can order by it in the
   * database instead of counting votes for every post it returns. Recomputed
   * from the votes on every change rather than nudged up and down, so it
   * cannot drift away from them.
   */
  @Prop({ required: true, default: 0, index: true })
  score: number;

  @Prop({ required: true, default: 0 })
  upvotes: number;

  @Prop({ required: true, default: 0 })
  downvotes: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// One post per user and subject: the merge rule, enforced by the database
// rather than only by the code that upserts.
PostSchema.index({ user_id: 1, subject_id: 1 }, { unique: true });
