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
   * How many flashcards the post would show right now.
   *
   * Kept on the post so the feed can leave out the empty ones without counting
   * cards for each, and so the carousel's own count comes with the page. Zero
   * is how a post is hidden: taking a subject back makes it drop out of the
   * feed, but its likes, its comments and the day it went up are still there
   * for when it goes public again - deleting it would spend somebody else's
   * ratings on one wrong click.
   *
   * Recounted by refresh() on every change, like everything else here.
   */
  @Prop({ required: true, default: 0 })
  cardCount: number;

  /**
   * How many people have liked it, kept here so the feed can order by it in
   * the database instead of counting likes for every post it returns.
   * Recounted from the likes on every change rather than nudged up and down,
   * so it cannot drift away from them.
   */
  @Prop({ required: true, default: 0, index: true })
  score: number;

  /**
   * When the post was taken out of the Community, and why.
   *
   * Taken out, not deleted: a post hidden while its reports are looked at may
   * well go back up, and one taken down for good is still the record of what
   * was there. Both are the same field because every reader's question is the
   * same - is this in the feed or not.
   */
  @Prop({ required: false, index: true })
  hiddenAt?: Date;

  /**
   * 'reports' is waiting to be looked at, 'admin' was taken down on its own,
   * 'ban' went down with its author - which is the one that has to be told
   * apart, so that lifting the ban puts back what the ban took and nothing
   * else.
   */
  @Prop({ required: false, enum: ['reports', 'admin', 'ban'] })
  hiddenReason?: 'reports' | 'admin' | 'ban';
}

export const PostSchema = SchemaFactory.createForClass(Post);

// One post per user and subject: the merge rule, enforced by the database
// rather than only by the code that upserts.
PostSchema.index({ user_id: 1, subject_id: 1 }, { unique: true });
