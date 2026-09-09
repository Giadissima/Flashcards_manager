import * as mongoose from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';
import {
  Visibility,
  defaultVisibility,
  visibilities,
} from 'src/common/visibility';

export type FlashcardDocument = Flashcard & Document;

// ? This file contains Flashcard MongoDb's schema
@Schema({
  collection: 'flashcard',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
  timestamps: true,
})
export class Flashcard {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: false })
  topic_id: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false,
  })
  subject_id: mongoose.Types.ObjectId;

  /**
   * Who this belongs to. Every list is scoped to it, and it is what the
   * Community section will group by once it exists.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: visibilities, default: defaultVisibility })
  visibility: Visibility;

  /**
   * True on a copy taken from somebody else's post. Such a card can be studied,
   * edited and deleted like any other, but never published again: passing on
   * someone's work as one's own is the one thing the Community must not make
   * easy.
   */
  @Prop({ required: true, default: false, index: true })
  imported: boolean;

  /**
   * The card this was copied from. Kept so the same card cannot be imported
   * twice, and so "how many people took this" can be counted later - a better
   * measure of usefulness than a vote, since it costs the reader something.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flashcard',
    required: false,
  })
  imported_from?: mongoose.Types.ObjectId;

  /**
   * Cascaded down from the topic's own flag (see TopicService.
   * setSpacedRepetition): kept here, denormalised, so the query behind the
   * daily test can filter flashcards directly instead of joining to topic on
   * every draw.
   */
  @Prop({ required: true, default: false })
  in_spaced_repetition: boolean;

  /**
   * The Leitner box the card is in - how well it is currently known - and the
   * date it next becomes due. Every review (see FlashcardsService.
   * recordReview) either advances the box and pushes the date out, or drops
   * the box back to 0 and the date back to now.
   */
  @Prop({ required: true, default: 0 })
  sr_box: number;

  @Prop({ required: true, default: Date.now })
  sr_due_at: Date;

  /**
   * Unset until the first review. What tells "never studied" (also box 0)
   * apart from "studied and still wrong" - the pair the weak-cards test reads.
   */
  @Prop({ required: false })
  sr_last_reviewed_at?: Date;
}
// ! known gap: by editing the request by hand a client can create a flashcard
// whose topic and subject are not related to each other, since nothing checks
// that. It is left as is on purpose - this is a small project to study on - but
// pull requests adding the check are welcome!
export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);
