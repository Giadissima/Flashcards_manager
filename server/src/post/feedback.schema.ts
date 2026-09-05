import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type FeedbackDocument = Feedback & Document;

/**
 * The exchange is closed at three messages, and the cap is the point of the
 * design rather than a limitation of it: reporter, one reply from the author,
 * one answer back. Each side speaks at most twice, the author's question is
 * worth asking because it can be answered, and it never becomes a chat.
 */
export const maxFeedbackMessages = 3;

@Schema({ _id: false })
export class FeedbackMessage {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt: Date;
}

export const FeedbackMessageSchema =
  SchemaFactory.createForClass(FeedbackMessage);

/**
 * A private note about one flashcard, from whoever is reading it to whoever
 * wrote it.
 *
 * Private on purpose. Correcting a stranger in public is awkward enough that
 * most people simply do not, so the reports that matter never arrive; and a
 * post whose comments fill with "typo in card 7" buries the conversation the
 * comments are for.
 */
@Schema({
  collection: 'feedback',
  timestamps: true,
})
export class Feedback {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flashcard',
    required: true,
    index: true,
  })
  flashcard_id: mongoose.Types.ObjectId;

  /** Who raised it. */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  reporter_id: mongoose.Types.ObjectId;

  /** Who owns the flashcard, stored so the inbox needs no join to be listed. */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  author_id: mongoose.Types.ObjectId;

  @Prop({ type: [FeedbackMessageSchema], required: true, default: [] })
  messages: FeedbackMessage[];
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

// One thread per person and flashcard: a second report on the same card
// continues the one already open instead of starting another.
FeedbackSchema.index({ reporter_id: 1, flashcard_id: 1 }, { unique: true });
