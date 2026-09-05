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
}
// ! known gap: by editing the request by hand a client can create a flashcard
// whose topic and subject are not related to each other, since nothing checks
// that. It is left as is on purpose - this is a small project to study on - but
// pull requests adding the check are welcome!
export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);
