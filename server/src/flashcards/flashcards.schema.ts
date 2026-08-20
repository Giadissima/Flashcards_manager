import * as mongoose from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

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
}
// ! known gap: by editing the request by hand a client can create a flashcard
// whose topic and subject are not related to each other, since nothing checks
// that. It is left as is on purpose - this is a small project to study on - but
// pull requests adding the check are welcome!
export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);
